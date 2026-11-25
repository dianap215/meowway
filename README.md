# Meowway

A Telegram MTProto proxy with a private dashboard, sponsored-channel settings, live usage statistics, and an optional Cloudflare WEB bridge. Built for easy deployment on Bot-Hosting, with automatic network configuration and a password you choose during setup.

- **Telegram channel:** [@BlueKnight_Net](https://t.me/BlueKnight_Net)
- **YouTube video:** [Watch on YouTube](https://www.youtube.com/watch?v=h4iHZY7bM3E)

## Deploy on Railway

1. Deploy this repository as one Railway service using its Dockerfile. Keep one replica.
2. Attach a volume at `/data` to keep the owner password, proxy secret, sponsorship settings, bridge configuration, and traffic totals across deployments.
3. Set the service variable `PORT=8080`. In **Settings** under **Networking**, generate an HTTPS domain targeting port `8080`.
4. Add a **TCP Proxy** targeting port `3128`. Railway assigns the public hostname and port used in the Telegram links. Redeploy after adding networking or the volume so Railway injects the service variables.
5. Once `/health` is healthy, open `/panel/` on the HTTPS domain. Use the one-time code in the deployment logs to create the owner password. Find the Telegram link under **Connection links**.

The panel shows total Telegram upload and download traffic in decimal GB. Railway's TCP ingress hides the original client IPs, so the Active users card shows the live connection count when a unique-user estimate is unavailable. CPU and memory come from container metrics.

See [Railway TCP Proxy](https://docs.railway.com/networking/tcp-proxy) and [Railway volume setup](https://docs.railway.com/volumes).
