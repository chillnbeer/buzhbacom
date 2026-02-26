<?php
// generator.php — принимает JSON и генерит страницу релиза в стиле главной buzhba.com

/* ====== НАСТРОЙКИ ====== */
$SECRET       = 'buzhba808506'; // !!! поменяй; бот шлёт его в заголовке X-Auth
$DOCROOT      = __DIR__;                  // /www/buzhba.com
$MAX_SLUG_LEN = 60;
$LOG_FILE     = __DIR__ . '/generator.log';

/* ====== ЛОГ ====== */
function glog($msg){
  global $LOG_FILE;
  @file_put_contents($LOG_FILE, date('[Y-m-d H:i:s] ') . $msg . "\n", FILE_APPEND);
}

/* ====== ОТВЕТ JSON ====== */
header('Content-Type: application/json; charset=utf-8');

try {
  if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error'=>'Method Not Allowed']); exit;
  }

  $auth = $_SERVER['HTTP_X_AUTH'] ?? '';
  if (!hash_equals($GLOBALS['SECRET'], $auth)) {
    http_response_code(401);
    echo json_encode(['error'=>'Unauthorized']); exit;
  }

  $raw = file_get_contents('php://input');
  $data = json_decode($raw, true);
  if (!$data) { http_response_code(400); echo json_encode(['error'=>'Bad JSON']); exit; }

  $aget = fn($k,$d=null)=> (isset($data[$k]) ? $data[$k] : $d);

  function slugify($s){
    $s = mb_strtolower($s, 'UTF-8');
    $map = [' '=>'-','—'=>'-','–'=>'-','_'=>'-','/'=>'-','\\'=>'-'];
    $s = strtr($s, $map);
    $s = @iconv('UTF-8','ASCII//TRANSLIT//IGNORE',$s);
    if ($s === false) $s = '';
    $s = preg_replace('~[^a-z0-9\-]+~','',$s);
    $s = preg_replace('~\-+~','-',$s);
    return trim($s,'-');
  }
  function h($s){ return htmlspecialchars((string)$s, ENT_QUOTES); }
  function is_youtube($u){ return (bool)preg_match('~(youtu\.be/|youtube\.com)~i',$u); }
  function yt_id($u){
    if (preg_match('~youtu\.be/([A-Za-z0-9_-]{11})~',$u,$m)) return $m[1];
    if (preg_match('~v=([A-Za-z0-9_-]{11})~',$u,$m)) return $m[1];
    if (preg_match('~/shorts/([A-Za-z0-9_-]{11})~',$u,$m)) return $m[1];
    return null;
  }

  /* ====== ВАЛИДАЦИЯ ====== */
  $title = trim((string)$aget('title',''));
  $slug  = trim((string)$aget('slug',''));
  $desc  = trim((string)$aget('description',''));
  $date  = trim((string)$aget('date',date('Y-m-d')));
  $links = $aget('links',[]);
  $cover_url = trim((string)$aget('cover_url',''));

  if ($title==='' || $slug==='' || !is_array($links) || empty($links)) {
    http_response_code(400); echo json_encode(['error'=>'Fields required: title, slug, links']); exit;
  }

  $slug = slugify(mb_substr($slug, 0, $MAX_SLUG_LEN));
  if ($slug==='') { http_response_code(400); echo json_encode(['error'=>'Bad slug']); exit; }

  /* ====== ТЕСТОВАЯ ДАТА РЕЛИЗА ====== */
  $today = new DateTime('today');
  $rel   = DateTime::createFromFormat('Y-m-d', $date) ?: $today;
  $isFuture = $rel > $today;
  $dateHuman = $rel->format('d.m.Y');
  $metaText = $isFuture ? "Выходит $dateHuman" : "Релиз: $dateHuman";

  /* ====== ДИРЕКТОРИЯ РЕЛИЗА ====== */
  $dir = $DOCROOT . DIRECTORY_SEPARATOR . $slug;
  if (is_dir($dir)) { http_response_code(409); echo json_encode(['error'=>'Slug already exists']); exit; }
  if (!@mkdir($dir, 0755, true)) { http_response_code(500); echo json_encode(['error'=>'Cannot create dir']); glog("mkdir failed: $dir"); exit; }

  /* ====== ОБЛОЖКА ====== */
  $coverPath = null;
  if ($cover_url) {
    $ext = pathinfo(parse_url($cover_url, PHP_URL_PATH), PATHINFO_EXTENSION) ?: 'jpg';
    $ext = strtolower($ext);
    if (!in_array($ext, ['jpg','jpeg','png','webp'])) $ext = 'jpg';
    $coverPath = $dir . '/cover.' . $ext;

    $ch = curl_init($cover_url);
    $fp = fopen($coverPath, 'wb');
    curl_setopt_array($ch, [
      CURLOPT_FILE=>$fp,
      CURLOPT_FOLLOWLOCATION=>true,
      CURLOPT_TIMEOUT=>40,
      CURLOPT_SSL_VERIFYPEER=>true
    ]);
    $ok = curl_exec($ch);
    curl_close($ch);
    fclose($fp);
    if (!$ok) { @unlink($coverPath); $coverPath = null; glog("cover download failed"); }
  }

  /* ====== DATA.JSON ====== */
  $dataJson = [
    'title'=>$title,'slug'=>$slug,'description'=>$desc,'date'=>$date,'links'=>$links,
    'cover'=> $coverPath ? basename($coverPath) : null
  ];
  file_put_contents($dir.'/data.json', json_encode($dataJson, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT));
  @chmod($dir.'/data.json', 0644);
  if ($coverPath && is_file($coverPath)) @chmod($coverPath, 0644);

  /* ====== ССЫЛКИ + YouTube ====== */
  $linksHtml = '';
  $youtubeId = null;
  foreach ($links as $lnk) {
    $n = h(trim((string)($lnk['name'] ?? '')));
    $u = h(trim((string)($lnk['url']  ?? '')));
    if (!$n || !$u) continue;
    if ($youtubeId === null && is_youtube($u)) {
      $yt = yt_id($u);
      if ($yt) $youtubeId = $yt;
    }
    $linksHtml .= "<a class=\"btn\" href=\"{$u}\" target=\"_blank\" rel=\"noopener\"><span class=\"txt\">{$n}</span></a>\n";
  }
  $ytSection = $youtubeId ? '<div class="yt"><iframe src="https://www.youtube.com/embed/'.$youtubeId.'?rel=0&modestbranding=1" allowfullscreen></iframe></div>' : '';

  /* ====== HTML ====== */
  $coverMeta = $coverPath ? '<meta property="og:image" content="https://'.$_SERVER['HTTP_HOST'].'/'.$slug.'/'.basename($coverPath).'" />' : '';
  $coverImg  = $coverPath ? '<img class="cover" src="'.basename($coverPath).'" alt="'.h($title).'" loading="lazy"/>' : '';

  $html = '<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
  <title>'.h($title).' — бужба</title>
  <meta name="description" content="'.h($desc).'">
  '.$coverMeta.'
  <style>body{background:#ffecd4;font:16px Inter,sans-serif;color:#000;margin:0}.wrap{max-width:580px;margin:40px auto;padding:0 14px}.panel{background:#ffecd4;border-radius:24px;box-shadow:0 24px 32px rgba(0,0,0,.08);padding:72px 28px 24px}.top{display:grid;justify-items:center;gap:10px;margin-bottom:6px}.avatar{width:96px;height:96px;border-radius:50%}.name{font-family:"Space Mono",monospace;font-size:22px}.socials{display:flex;gap:12px;justify-content:center;margin-top:10px}.socials img{width:40px;height:40px}.meta{color:rgba(0,0,0,.55);text-align:center;margin:12px 0;font-size:14px}.cover{width:100%;border-radius:16px;margin:12px 0 18px}.yt{position:relative;width:100%;padding-top:56.25%;margin-bottom:14px}.yt iframe{position:absolute;inset:0;width:100%;height:100%;border:0}.links{display:grid;gap:14px}.btn{display:flex;align-items:center;justify-content:center;min-height:64px;padding:0 42px;border:1px solid #ccbeb4;border-radius:32px;text-decoration:none;color:#000;transition:.2s}.btn:hover{transform:translateY(-1px);border-color:#bfb1a5;border-width:2px}.footer{text-align:center;font-size:12px;opacity:.7;padding:18px 0 8px}</style>
</head>
<body>
<main class="wrap">
  <section class="panel">
    <header class="top">
      <img class="avatar" src="/logo.png" alt="buzhba">
      <div class="name"><img src="/logo2.png" width="250" alt="бужба"></div>
    </header>
    <h1>'.h($title).'</h1>
    <div class="meta">'.$metaText.'</div>
    '.$ytSection.$coverImg.'
    <div class="links">'.$linksHtml.'</div>
  </section>
  <footer class="footer">© бужба</footer>
</main>
</body>
</html>';

  file_put_contents($dir.'/index.html', $html);
  @chmod($dir.'/index.html', 0644);
  @chmod($dir, 0755);

  echo json_encode(['ok'=>true,'url'=>'https://'.$_SERVER['HTTP_HOST'].'/'.$slug]);

} catch (Throwable $e) {
  glog('fatal: '.$e->getMessage());
  http_response_code(500);
  echo json_encode(['error'=>'Internal error']);
}
