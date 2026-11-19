import { createClient } from '@supabase/supabase-js';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { IUploadProvider, UploadedStream } from './upload.interface';
import { isSafePublicHttpsUrl } from '../dtos/webhooks/webhook.url.validator';
import { ssrfSafeDispatcher } from '../dtos/webhooks/ssrf.safe.dispatcher';
import { parseDataUrl } from './data.url';
import { ALLOWED_MIME_TYPES } from './cloudflare.storage';
const { fileTypeFromBuffer } = require('file-type');

export class SupabaseStorage implements IUploadProvider {
  private readonly client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  readonly bucket = process.env.SUPABASE_STORAGE_BUCKET || 'agency-media';
  private readonly s3 = new S3Client({
    endpoint: `${process.env.SUPABASE_URL}/storage/v1/s3`,
    region: process.env.SUPABASE_STORAGE_REGION || 'local',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.SUPABASE_S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.SUPABASE_S3_SECRET_ACCESS_KEY!,
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
  });

  private key(input: string) {
    let key = input;
    if (input.startsWith('http')) {
      const base = this.publicUrl('');
      if (!input.startsWith(base))
        throw new Error('The media URL is outside this storage provider');
      key = decodeURIComponent(input.slice(base.length));
    }
    if (
      !key ||
      key.startsWith('/') ||
      key.split('/').some((part) => !part || part === '.' || part === '..') ||
      !/^[a-zA-Z0-9_./-]+$/.test(key)
    )
      throw new Error('Invalid storage key');
    return key;
  }

  publicUrl(key: string) {
    return `${
      process.env.FRONTEND_URL
    }/api/backend/media/private/${encodeURIComponent(key)}`;
  }
  async sealFile(input: string) {
    const source = this.key(input);
    const ext = source.split('.').pop();
    const filename = `sealed/${randomUUID()}.${ext}`;
    const { error } = await this.client.storage
      .from(this.bucket)
      .copy(source, filename);
    if (error) throw error;
    return { filename, path: this.publicUrl(filename) };
  }
  async resolveDownloadUrl(path: string) {
    return path.startsWith(this.publicUrl(''))
      ? this.signDownloadUrl(this.key(path))
      : path;
  }
  async signDownloadUrl(key: string, expiresIn = 3 * 3600) {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(this.key(key), expiresIn);
    if (error) throw error;
    return data.signedUrl;
  }
  async signUploadUrl(key: string, contentType: string) {
    return getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.key(key),
        ContentType: contentType,
      }),
      { expiresIn: 3 * 3600 }
    );
  }
  async signedBrowserUpload(key: string) {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUploadUrl(this.key(key), { upsert: false });
    if (error) throw error;
    return {
      token: data.token,
      apiKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      endpoint: `${process.env.SUPABASE_URL}/storage/v1/upload/resumable/sign`,
      bucket: this.bucket,
    };
  }
  async probeFile(key: string) {
    const params = { Bucket: this.bucket, Key: this.key(key) };
    const info = await this.s3.send(new HeadObjectCommand(params));
    const { Body } = await this.s3.send(
      new GetObjectCommand({ ...params, Range: 'bytes=0-8191' })
    );
    return {
      size: info.ContentLength,
      bytes: Buffer.from(await Body!.transformToByteArray()),
    };
  }
  async uploadSimple(input: string) {
    const data = input.startsWith('data:') ? parseDataUrl(input).buffer : null;
    if (!data && !(await isSafePublicHttpsUrl(input)))
      throw new Error('Unsafe URL');
    const body =
      data ||
      Buffer.from(
        await (
          await fetch(input, { dispatcher: ssrfSafeDispatcher } as any)
        ).arrayBuffer()
      );
    const file = await this.uploadFile({ buffer: body } as Express.Multer.File);
    return file.path;
  }
  async uploadFile(file: Express.Multer.File) {
    const detected = await fileTypeFromBuffer(file.buffer);
    if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime))
      throw new Error('Unsupported file type');
    const key = `${randomUUID()}.${detected.ext}`;
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(key, file.buffer, { contentType: detected.mime, upsert: false });
    if (error) throw error;
    return {
      filename: key,
      originalname: file.originalname || key,
      path: this.publicUrl(key),
      mimetype: detected.mime,
      size: file.buffer.length,
    };
  }
  async uploadStream(
    stream: Readable,
    mimetype: string,
    ext: string
  ): Promise<UploadedStream> {
    if (!ALLOWED_MIME_TYPES.has(mimetype) || !/^[a-z0-9]+$/i.test(ext))
      throw new Error('Unsupported file type');
    const key = `${randomUUID()}.${ext}`;
    await new Upload({
      client: this.s3,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: stream,
        ContentType: mimetype,
      },
    }).done();
    return {
      filename: key,
      originalname: key,
      path: this.publicUrl(key),
      mimetype,
    };
  }
  async removeFile(input: string) {
    const { error } = await this.client.storage
      .from(this.bucket)
      .remove([this.key(input)]);
    if (error) throw error;
  }
  async readFile(key: string) {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .download(this.key(key));
    if (error) throw error;
    return data.text();
  }
  async writeFile(key: string, body: string, contentType: string) {
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(this.key(key), body, { contentType, upsert: false });
    if (error) throw error;
  }
}
