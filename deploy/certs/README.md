# Supabase database certificate authority

`supabase-root-2021.crt` is a public CA certificate downloaded from Mireva's Database Settings → SSL configuration link:

https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

Subject/issuer: `CN=Supabase Root 2021 CA, O=Supabase Inc`. Valid through April 26, 2031. SHA-256 fingerprint:

`80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`

The Vercel container adds this CA to its own OpenSSL store for Prisma and uses `NODE_EXTRA_CA_CERTS` for Node/Postgres clients. It does not alter the host or another project's trust store. Keep certificate/hostname verification enabled. Before renewal, use the certificate offered by the intended Supabase project's authenticated dashboard and verify its issuer, fingerprint and validity. See [Supabase SSL guidance](https://supabase.com/docs/guides/platform/ssl-enforcement).
