import { BasePlugin } from '@uppy/core';

// Direct, resumable TUS uploads keep video bytes outside Vercel Functions.
export class SupabaseUppy extends BasePlugin<{ id?: string; fetch: any }, any, any> {
  private controllers = new Map<string, AbortController>();
  constructor(uppy: any, options: { fetch: any }) {
    super(uppy, options); this.id = 'SupabaseUppy'; this.type = 'uploader';
  }
  private removed = (file: any) => { this.controllers.get(file.id)?.abort(); };
  private cancel = () => { this.controllers.forEach(controller => controller.abort()); };
  private api = async (path: string, body: unknown) => {
    const response = await this.opts.fetch(path, { method: 'POST', body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Upload could not be completed');
    return data;
  };
  private encode(value: string) {
    return btoa(Array.from(new TextEncoder().encode(value), byte => String.fromCharCode(byte)).join(''));
  }
  private upload = async (ids: string[]) => {
    await Promise.all(ids.map(async id => {
      const file = this.uppy.getFile(id);
      if (!file) return;
      const controller = new AbortController(); this.controllers.set(id, controller);
      try {
        this.uppy.emit('upload-start', [file]);
        const ticket = await this.api('/media/supabase/initialize', { name: file.name, size: file.size, contentType: file.type });
        const headers = { 'Tus-Resumable': '1.0.0', 'x-signature': ticket.token, 'x-upsert': 'false', apikey: ticket.apiKey };
        const started = await fetch(ticket.endpoint, { method: 'POST', signal: controller.signal, headers: {
          ...headers, 'Upload-Length': String(file.size),
          'Upload-Metadata': Object.entries({ bucketName: ticket.bucket, objectName: ticket.objectKey, contentType: file.type, cacheControl: '3600' }).map(([key, value]) => `${key} ${this.encode(String(value))}`).join(','),
        } });
        const location = started.headers.get('Location');
        if (!started.ok || !location) throw new Error('Could not start the resumable upload');
        const uploadUrl = new URL(location, ticket.endpoint);
        if (uploadUrl.origin !== new URL(ticket.endpoint).origin) throw new Error('Unexpected upload destination');
        let offset = 0;
        let failures = 0;
        while (offset < file.size) {
          try {
            const chunk = (file.data as Blob).slice(offset, Math.min(offset + 6 * 1024 * 1024, file.size));
            const result = await fetch(uploadUrl, { method: 'PATCH', signal: controller.signal,
              headers: { ...headers, 'Upload-Offset': String(offset), 'Content-Type': 'application/offset+octet-stream' }, body: chunk });
            if (!result.ok) throw new Error('Chunk upload failed');
            const next = Number(result.headers.get('Upload-Offset'));
            if (!Number.isSafeInteger(next) || next <= offset || next > file.size) throw new Error('Invalid upload offset');
            offset = next; failures = 0;
            this.uppy.emit('upload-progress', file, { uploadStarted: file.progress.uploadStarted || Date.now(), bytesUploaded: offset, bytesTotal: file.size });
          } catch (error) {
            if (controller.signal.aborted || ++failures > 3) throw error;
            const probe = await fetch(uploadUrl, { method: 'HEAD', signal: controller.signal, headers });
            const resumed = Number(probe.headers.get('Upload-Offset'));
            if (!probe.ok || !Number.isSafeInteger(resumed) || resumed < 0 || resumed > file.size) throw error;
            offset = resumed;
          }
        }
        const saved = await this.api(`/media/supabase/${ticket.ticketId}/complete`, {});
        if (this.uppy.getFile(id)) this.uppy.emit('upload-success', file, { status: 200, body: { saved, Location: saved.path }, uploadURL: saved.path });
      } catch (error) {
        if (this.uppy.getFile(id)) this.uppy.emit('upload-error', file, error as Error);
      } finally { this.controllers.delete(id); }
    }));
  };
  install() { this.uppy.addUploader(this.upload); this.uppy.on('file-removed', this.removed); this.uppy.on('cancel-all', this.cancel); }
  uninstall() { this.cancel(); this.uppy.removeUploader(this.upload); this.uppy.off('file-removed', this.removed); this.uppy.off('cancel-all', this.cancel); }
}
