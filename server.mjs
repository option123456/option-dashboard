import http from "node:http";

const PORT = Number(process.env.PORT || 10000);
const HOST = "0.0.0.0";

const page = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>داشبورد اختیار معامله</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 30px;
      background: #f5f5f5;
      color: #222;
      text-align: center;
    }

    .box {
      max-width: 700px;
      margin: 50px auto;
      padding: 30px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 3px 15px rgba(0,0,0,.1);
    }

    h1 {
      margin-bottom: 20px;
    }

    .ok {
      color: green;
      font-size: 20px;
      font-weight: bold;
    }
  </style>
</head>

<body>
  <div class="box">
    <h1>📈 داشبورد اختیار معامله</h1>
    <p class="ok">✅ سرور با موفقیت اجرا شد</p>
    <p>اتصال Render برقرار است.</p>
  </div>
</body>
</html>`;

function handler(req, res) {
  if (req.url === "/health") {
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("ok");
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8"
  });

  res.end(page);
}

const server = http.createServer(handler);

server.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
});
