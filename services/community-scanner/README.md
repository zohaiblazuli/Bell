# Community PDF scanner

Deploy this image as a single always-on private worker after applying the Supabase migration. Give it
only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; never expose either value to Bell clients.

Update ClamAV definitions in the image or at startup before production use. The worker rejects
encrypted PDFs and files containing JavaScript, launch actions, open actions, or embedded files,
then rewrites the accepted document before publishing it. Run the container with no inbound port,
a read-only root filesystem, a bounded temporary volume, no extra Linux capabilities, and explicit
CPU/memory limits.

