#!/bin/bash

# Configuration
API_URL="http://localhost:3000/api/sensor-record"
IDENTITAS="START" # Use "FINISH" or whatever your checkpoint identity is
EPC="1001" # Put a valid bib/EPC here
EVENT_ID=1 # Change to your active Event ID
TIME=$(date +%H:%M:%S.%3N) # Auto generate current time in HH:MM:SS.ms format

echo "Sending Decoder Hit to $API_URL"
echo "Payload:"
echo "[{\"i\": \"$IDENTITAS\", \"e\": \"$EPC\", \"t\": \"$TIME\", \"eventId\": $EVENT_ID, \"rssi\": -55}]"
echo ""

curl -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d "[{\"i\": \"$IDENTITAS\", \"e\": \"$EPC\", \"t\": \"$TIME\", \"eventId\": $EVENT_ID, \"rssi\": -55}]"

echo -e "\n\nDone."
