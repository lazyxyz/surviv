Setup Wildcard SSL for eu.surviv.fun (Europe)
1. Configure DNS in Cloudflare

Log into Cloudflare, select surviv.fun.
Add/verify DNS records:
A: eu.surviv.fun → Server IP, Proxied (orange cloud).
A: *.eu.surviv.fun → Server IP, Proxied (orange cloud, WebSocket works with proxy).



2. Open Firewall Ports (Hetzner)

On server:sudo ufw allow 80
sudo ufw allow 443


In Hetzner Cloud Console, ensure firewall allows inbound TCP 80, 443 from 0.0.0.0/0.

3. Request Wildcard Certificate

Stop Nginx:sudo systemctl stop nginx


Run Certbot:sudo certbot certonly --manual --preferred-challenges dns -d eu.surviv.fun -d *.eu.surviv.fun


Certbot provides a TXT record:_acme-challenge.eu.surviv.fun with value <random-string>



4. Add TXT Record in Cloudflare

Go to DNS > Records > Add Record:
Type: TXT
Name: _acme-challenge.eu
Content: <random-string>
TTL: Auto or 120 seconds
Proxy Status: DNS Only (grey cloud)


Save and wait 5–10 minutes.

5. Verify TXT Record

Check with:dig @1.1.1.1 _acme-challenge.eu.surviv.fun TXT

Or use: https://toolbox.googleapps.com/apps/dig/#TXT/_acme-challenge.eu.surviv.fun
Confirm <random-string> appears. Press Enter in Certbot to continue.

6. Add Page Rules for *.eu.surviv.fun/*

SSL: Strict, Cache Level: Bypass

![Screenshot 2025-06-29 at 00 23 07](https://github.com/user-attachments/assets/b9ec0d10-972a-4f62-8881-3d1f6f82fe25)
