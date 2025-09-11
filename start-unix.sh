#!/bin/bash

(cd backend && npm run dev) &
(cd frontend && npm run dev) &

url=$(grep -oE 'http://[^"]+' <(cd frontend && npm run dev))
xdg-open "$url"

