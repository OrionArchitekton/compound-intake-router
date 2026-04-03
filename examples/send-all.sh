#!/bin/bash
# Send all 5 example payloads to the intake router

BASE="http://localhost:${PORT:-3747}"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "=== Compound Intake Router — Demo ==="
echo "=== Sending 5 payloads to $BASE/intake ==="
echo ""

for file in "$DIR"/lead.json "$DIR"/partnership.json "$DIR"/support.json "$DIR"/applicant.json "$DIR"/spam.json; do
  name=$(basename "$file" .json)
  echo "--- [$name] ---"
  curl -s -X POST "$BASE/intake" \
    -H "Content-Type: application/json" \
    -d @"$file" | node -e "
      let d='';
      process.stdin.on('data',c=>d+=c);
      process.stdin.on('end',()=>{
        try{
          const r=JSON.parse(d);
          console.log('  ID:      '+r.id);
          console.log('  Type:    '+r.classification.type+' ('+r.classification.urgency+')');
          console.log('  Venture: '+r.classification.venture);
          console.log('  Action:  '+r.classification.suggestedAction);
          console.log('  Route:   '+r.routing.destination+' ['+r.routing.mode+']');
          console.log('  Time:    '+r.processingMs+'ms');
          const p=r.pipeline;
          console.log('  Pipeline: '+ Object.entries(p).map(([k,v])=>k+'='+v).join(', '));
        }catch(e){console.log(d)}
      })
    "
  echo ""
  sleep 1
done

echo "=== Done. Run 'npm run view-log' to see the audit trail. ==="
echo ""
