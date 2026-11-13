#!/usr/bin/env bash
# Makes one fake test business per product (Groom, Mart, Dine, Cloth, Wash, Hire) through each product's own sign-up route.
# Run on the server, as root. Passwords are random and written ONLY to /root/afra-test-logins.txt (mode 600). They are never printed.
# Safe to run twice: a product whose test email already exists is skipped.
set -u
OUT=/root/afra-test-logins.txt
umask 077
touch "$OUT"; chmod 600 "$OUT"
# product  port  api-path  header  name-field  site
LIST="salon:5007:salon:afra-groom:businessName:groom
mart:5008:mart:afra-mart:shopName:mart
dine:5009:dine:afra-dine:venueName:dine
cloth:5010:cloth:afra-cloth:shopName:cloth
wash:5011:wash:afra-wash:businessName:wash
hire:5006:hire:afra-hire:agencyName:hire"
echo "$LIST" | while IFS=: read -r p port api hdr field site; do
  email="test.$p@afraventures.in"
  if grep -q "$email" "$OUT" 2>/dev/null; then echo "$p: already made, skipped"; continue; fi
  pw="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)Aa1"
  body=$(printf '{"%s":"Test %s (fake data)","ownerName":"Test Owner","email":"%s","state":"Puducherry","password":"%s","acceptTerms":true,"salesContactOk":false}' "$field" "$p" "$email" "$pw")
  code=$(curl -s -o /tmp/mta.$$ -w '%{http_code}' -X POST "http://127.0.0.1:$port/api/$api/auth/signup" -H 'Content-Type: application/json' -H "X-Requested-With: $hdr" -d "$body")
  if [ "$code" = "200" ] || [ "$code" = "201" ]; then
    printf 'https://%s.afraventures.in   email: %s   password: %s\n' "$site" "$email" "$pw" >> "$OUT"
    echo "$p: created ($email)"
  else
    echo "$p: FAILED http $code: $(head -c 160 /tmp/mta.$$)"
  fi
  rm -f /tmp/mta.$$
done
echo "Logins are in $OUT (read it with: cat $OUT). Do not paste it into chat or git."
