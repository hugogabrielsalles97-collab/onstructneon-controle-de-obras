const https = require('https');

https.get('https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyAiUELGQ9Eb6LNG_tI6F8daC3ag8i9F208', (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log(body));
}).on('error', e => console.error(e));
