<?php
/* ===== НАСТРОЙКИ ===== */
$BOT_TOKEN = '7299347744:AAFIXh_lrEb8lNJJV-tj067RtDjPTrCAn4s';   // токен из @BotFather
$ADMIN_ID  = 145661035;                // твой id из @userinfobot (число)
$SECRET    = 'buzhba808506';           // этим же поставишь secret_token в setWebhook
$DATA_FILE = __DIR__ . '/data.json';
$BACKUP_DIR= __DIR__ . '/data.backups';

/* ===== ЗАЩИТА ВЕБХУКА ===== */
if (($_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] ?? '') !== $SECRET) {
  http_response_code(403); exit('forbidden');
}

/* ===== ЛОГ (на время отладки можно оставить) ===== */
$raw = file_get_contents('php://input');
@file_put_contents(__DIR__.'/bot.log', date('c')." RAW: ".$raw."\n", FILE_APPEND);
$update = json_decode($raw, true);

/* ===== ХЕЛПЕРЫ ===== */
function tg($m,$p){ global $BOT_TOKEN;
  $u="https://api.telegram.org/bot{$BOT_TOKEN}/$m";
  $o=['http'=>['method'=>'POST','header'=>"Content-Type: application/json",
               'content'=>json_encode($p, JSON_UNESCAPED_UNICODE)]];
  $res = @file_get_contents($u, false, stream_context_create($o));
  return $res ? json_decode($res, true) : null;
}
function send($chat,$text){ return tg('sendMessage',[
  'chat_id'=>$chat,'text'=>$text,'parse_mode'=>'HTML','disable_web_page_preview'=>true
]); }

function loadData(){ global $DATA_FILE;
  if (!file_exists($DATA_FILE)) return ['title'=>'@buzhba — ссылки','items'=>[]];
  return json_decode(file_get_contents($DATA_FILE), true) ?: ['title'=>'@buzhba — ссылки','items'=>[]];
}
function saveData($data){ global $DATA_FILE,$BACKUP_DIR;
  if (!is_dir($BACKUP_DIR)) @mkdir($BACKUP_DIR,0755,true);
  @copy($DATA_FILE, $BACKUP_DIR.'/'.date('Y-m-d_H-i-s').'.json');
  $tmp=$DATA_FILE.'.tmp';
  file_put_contents($tmp, json_encode($data, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT), LOCK_EX);
  rename($tmp, $DATA_FILE); // атомарная запись
}
function urlOK($u){ return (bool)filter_var($u, FILTER_VALIDATE_URL) && preg_match('~^https?://~i',$u); }

/* ===== РОУТИНГ ===== */
$msg = $update['message'] ?? null;
if (!$msg) exit('ok');

$chat = $msg['chat']['id'] ?? 0;
$from = $msg['from']['id'] ?? 0;
$text = trim($msg['text'] ?? '');

if ($from != $ADMIN_ID) exit('ok'); // только админ

$data = loadData();

/* ===== КОМАНДЫ ===== */
if (preg_match('~^/start~i', $text)) {
  send($chat,
"Привет, Жорж!

<b>Команды:</b>
/add Название | https://url — добавить (наверх)
/addp Название | https://url — добавить и закрепить 📌
/list — показать список
/pin ID — закрепить  •  /unpin ID — открепить
/rename ID | Новый текст
/edit ID | https://новый-url
/del ID — удалить
title Новый заголовок");
  exit;
}

if (preg_match('~^/list~i', $text)) {
  $items = $data['items'] ?? [];
  $pinned  = array_values(array_filter($items, fn($i)=>!empty($i['pin'])));
  $regular = array_values(array_filter($items, fn($i)=>empty($i['pin'])));
  $lines = [];
  if ($pinned) {
    $lines[] = "<b>📌 Закреплённые</b>";
    foreach ($pinned as $i) $lines[] = "{$i['id']}. <b>{$i['label']}</b> — <a href=\"{$i['url']}\">ссылка</a>";
  }
  if ($regular) {
    if ($pinned) $lines[] = "";
    $lines[] = "<b>Ссылки</b>";
    foreach ($regular as $i) $lines[] = "{$i['id']}. {$i['label']} — <a href=\"{$i['url']}\">ссылка</a>";
  }
  send($chat, $lines ? implode("\n",$lines) : "Пока пусто. Добавь так:\n<code>/add Текст | https://url</code>");
  exit;
}

if (preg_match('~^/addp\s+(.+?)\s*\|\s*(https?://\S+)~ui', $text, $m)
 || preg_match('~^/add\s+(.+?)\s*\|\s*(https?://\S+)~ui', $text, $n)) {
  $isPin = isset($m[0]); $m = $isPin ? $m : $n;
  $label = trim($m[1]); $url = trim($m[2]);
  if (!urlOK($url)) { send($chat, "Неверный URL"); exit; }
  $ids = array_column($data['items'] ?? [], 'id'); $next = $ids ? max($ids)+1 : 1;
  array_unshift($data['items'], ['id'=>$next,'label'=>$label,'url'=>$url,'pin'=>$isPin]); // сразу ВВЕРХ
  saveData($data);
  send($chat, $isPin ? "📌 Добавил и закрепил: {$label} (ID {$next})" : "✅ Добавил: {$label} (ID {$next})");
  exit;
}

if (preg_match('~^/pin\s+(\d+)~i', $text, $x)) {
  $id=(int)$x[1]; foreach($data['items'] as &$it){ if($it['id']==$id){ $it['pin']=true; saveData($data); send($chat,"📌 Закрепил ID {$id}"); exit; } }
  send($chat,"Не нашёл ID {$id}"); exit;
}
if (preg_match('~^/unpin\s+(\d+)~i', $text, $x)) {
  $id=(int)$x[1]; foreach($data['items'] as &$it){ if($it['id']==$id){ $it['pin']=false; saveData($data); send($chat,"📍 Открепил ID {$id}"); exit; } }
  send($chat,"Не нашёл ID {$id}"); exit;
}

if (preg_match('~^/rename\s+(\d+)\s*\|\s*(.+)$~u', $text, $x)) {
  $id=(int)$x[1]; $label=trim($x[2]);
  foreach($data['items'] as &$it){ if($it['id']==$id){ $it['label']=$label; saveData($data); send($chat,"✏️ Переименовал ID {$id}"); exit; } }
  send($chat,"Не нашёл ID {$id}"); exit;
}

if (preg_match('~^/edit\s+(\d+)\s*\|\s*(https?://\S+)~i', $text, $x)) {
  $id=(int)$x[1]; $url=trim($x[2]);
  if(!urlOK($url)){ send($chat,"Неверный URL"); exit; }
  foreach($data['items'] as &$it){ if($it['id']==$id){ $it['url']=$url; saveData($data); send($chat,"🔗 Обновил ссылку ID {$id}"); exit; } }
  send($chat,"Не нашёл ID {$id}"); exit;
}

if (preg_match('~^/del\s+(\d+)~i', $text, $x)) {
  $id=(int)$x[1];
  $before = count($data['items']); 
  $data['items'] = array_values(array_filter($data['items'], fn($it)=>$it['id']!=$id));
  saveData($data);
  send($chat, ($before==count($data['items'])) ? "Не нашёл ID {$id}" : "🗑 Удалил ID {$id}");
  exit;
}

if (preg_match('~^title\s+(.+)$~u', $text, $x)) {
  $data['title'] = trim($x[1]); saveData($data); send($chat,"🧾 Заголовок обновлён."); exit;
}

/* если ничего не совпало */
send($chat,"Не понял. Напиши /start");
