# HTTPS certificates (certbot)
Run after DNS shows the name pointing at 200.141.15.246 (`dig +short <name>`), and after each site file is linked and `sudo nginx -t` is OK.
```
sudo certbot --nginx -d fit.afraventures.in -m <owner email> --agree-tos --redirect
sudo certbot --nginx -d groom.afraventures.in -m <owner email> --agree-tos --redirect
sudo certbot --nginx -d mart.afraventures.in  -m <owner email> --agree-tos --redirect
sudo certbot --nginx -d dine.afraventures.in  -m <owner email> --agree-tos --redirect
sudo certbot --nginx -d cloth.afraventures.in -m <owner email> --agree-tos --redirect
sudo certbot --nginx -d wash.afraventures.in  -m <owner email> --agree-tos --redirect
sudo certbot --nginx -d hire.afraventures.in  -m <owner email> --agree-tos --redirect
sudo certbot --nginx -d admin.afraventures.in -m <owner email> --agree-tos --redirect
```
Check renewal works: `sudo certbot renew --dry-run`. Let's Encrypt allows 50 certificates per week per registered domain; eight is fine.
Product names and addresses (groom, mart, dine, cloth, wash, hire) are drafts until the owner confirms them (docs/SUPER_ADMIN_AND_URLS.md); change the host name inside the matching file before step one if a name changes.
