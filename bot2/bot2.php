<?php
/* ================== НАСТРОЙКИ ================== */
$BOT_TOKEN = '8322392604:AAFboyOd4hyZBP83iaT79eq6UAB5rAFKX5E';   // ← вставь новый токен
$ADMIN_ID  = 145661035;                 // ← твой Telegram ID
$SECRET    = 'buzhba808506';            // ← параметр безопасности ?secret=...
$ROOT      = __DIR__;
$DATA_FILE = dirname(__DIR__) . '/data.json';   // <-- корневой файл
$BACKUP_DIR= $ROOT . '/data.backups';          // бэкапы оставляем в /bot2
$LOG_FILE  = $ROOT . '/bot.log';
$LOG_MAX   = 1024 * 1024;
$PUSH_URL  = null;                      // например 'https://buzhba.com/links-hook' или null

/* ================== ДИАГНОСТИКА ================== */
ini_set('display_errors', 0);
error_reporting(E_ALL);
if (!is_dir($BACKUP_DIR)) @mkdir($BACKUP_DIR, 0750, true);

/* ================== УТИЛИТЫ ================== */
function httpPost($url, $data){
  $ctx = stream_context_create(['http'=>[
    'method'=>'POST',
    'header'=>"Content-Type: application/json",
    'content'=>json_encode($data, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)
  ]]);
  return file_get_contents($url, false, $ctx);
}
function tg($method, $payload){
  global $BOT_TOKEN;
  return httpPost("https://api.telegram.org/bot{$BOT_TOKEN}/{$method}", $payload);
}
function sendMessage($chat_id, $text, $opt=[]){
  $payload = array_merge([
    'chat_id'=>$chat_id,
    'text'=>$text
  ], $opt);
  return tg('sendMessage', $payload);
}
function answerCallback($cb_id, $text=''){
  return tg('answerCallbackQuery', ['callback_query_id'=>$cb_id, 'text'=>$text, 'show_alert'=>false]);
}
function editMessageReplyMarkup($chat_id,$message_id,$markup){
  return tg('editMessageReplyMarkup', [
    'chat_id'=>$chat_id,'message_id'=>$message_id,'reply_markup'=>$markup
  ]);
}
function loadDB(){
  global $DATA_FILE;
  if (!file_exists($DATA_FILE)){
    $init = ['title'=>'@buzhba — ссылки', 'items'=>[], 'states'=>[]];
    file_put_contents($DATA_FILE, json_encode($init, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
  }
  return json_decode(file_get_contents($DATA_FILE), true);
}
function saveDB($db){
  global $DATA_FILE, $BACKUP_DIR, $LOG_FILE, $LOG_MAX;
  // rotate log
  if (file_exists($LOG_FILE) && filesize($LOG_FILE) > $LOG_MAX){
    @rename($LOG_FILE, $LOG_FILE.'.1');
  }
  // backup json
  $stamp = date('Ymd-His');
  @copy($DATA_FILE, "{$BACKUP_DIR}/{$stamp}.json");
  file_put_contents($DATA_FILE, json_encode($db, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
}
function kb_main(){
  return json_encode([
    'keyboard'=>[
      [ ['text'=>'/add'], ['text'=>'/addp'] ],
      [ ['text'=>'/list'] ],
      [ ['text'=>'/rename'], ['text'=>'/edit'] ],
      [ ['text'=>'/pin'], ['text'=>'/unpin'] ],
      [ ['text'=>'/del'] ],
    ],
    'resize_keyboard'=>true, 'one_time_keyboard'=>false
  ], JSON_UNESCAPED_UNICODE);
}
function logit($m){ global $LOG_FILE; file_put_contents($LOG_FILE, "[".date('c')."] ".$m."\n", FILE_APPEND); }

/* ================== ЗАЩИТА ХУКА ================== */
if (php_sapi_name() !== 'cli') {
  if (!isset($_GET['secret']) || $_GET['secret'] !== $SECRET) {
    http_response_code(403);
    echo "forbidden";
    exit;
  }
}

/* ================== ПАРСИНГ UPDATE ================== */
$raw = file_get_contents('php://input');
if (!$raw) { echo "ok"; exit; }
$update = json_decode($raw, true);
logit($raw);

$chat_id = null; $text = null; $caption = null;
if (isset($update['message'])) {
  $msg = $update['message'];
  $chat_id = $msg['chat']['id'];
  $text = $msg['text'] ?? null;
  $caption = $msg['caption'] ?? null;
}
if (isset($update['callback_query'])) {
  $cb  = $update['callback_query'];
  $chat_id = $cb['message']['chat']['id'];
}

$db = loadDB();
if (!isset($db['states'])) $db['states']=[];
if ($chat_id && !isset($db['states'][$chat_id])) $db['states'][$chat_id]=['mode'=>null,'tmp'=>[]];
$st = &$db['states'][$chat_id];

/* ================== ХЕЛПЕРЫ РАБОТЫ СО СПИСКОМ ================== */
function nextId($items){
  $max = 0; foreach($items as $i){ if(($i['id']??0)>$max) $max=$i['id']; } return $max+1;
}
function getItemIndexById(&$items, $id){
  foreach($items as $k=>$v){ if ((int)$v['id']===(int)$id) return $k; }
  return -1;
}

/* ================== КОМАНДЫ ================== */
if (isset($msg)) {
  $is_admin = ($msg['from']['id'] == $ADMIN_ID);

  // /start
  if ($text === '/start'){
    sendMessage($chat_id,
"Привет, Жорж!

Команды:
• /add — добавить
• /addp — добавить и закрепить 📌
• /list — показать список
• /rename — переименовать
• /edit — изменить ссылку
• /pin — закрепить
• /unpin — открепить
• /del — удалить

Пиши или жми кнопку ниже.", ['reply_markup'=>kb_main()]);
    echo "ok"; exit;
  }

  // /setcmds — разово прописать меню команд
  if ($text === '/setcmds' && $is_admin){
    tg('setMyCommands', ['commands'=>[
      ['command'=>'add','description'=>'Добавить ссылку'],
      ['command'=>'addp','description'=>'Добавить и закрепить'],
      ['command'=>'list','description'=>'Показать список'],
      ['command'=>'rename','description'=>'Переименовать'],
      ['command'=>'edit','description'=>'Изменить URL'],
      ['command'=>'pin','description'=>'Закрепить'],
      ['command'=>'unpin','description'=>'Открепить'],
      ['command'=>'del','description'=>'Удалить'],
    ]]);
    sendMessage($chat_id, "Команды обновлены ✅", ['reply_markup'=>kb_main()]);
    echo "ok"; exit;
  }

  // запуск диалога /add /addp
  if ($text === '/add' || $text === '/addp'){
    $st['mode'] = ($text==='/addp') ? 'addp_title' : 'add_title';
    $st['tmp']  = ['pin'=>($text==='/addp')];
    saveDB($db);
    sendMessage($chat_id, "Напиши название ссылки:", ['reply_markup'=>json_encode(['force_reply'=>true])]);
    echo "ok"; exit;
  }

  // ожидание названия
  if ($st['mode'] === 'add_title' || $st['mode'] === 'addp_title'){
    $st['tmp']['label'] = trim($text ?: $caption ?: '');
    $st['mode'] = 'add_url';
    saveDB($db);
    sendMessage($chat_id, "Теперь пришли URL (начинается с http…)", ['reply_markup'=>json_encode(['force_reply'=>true])]);
    echo "ok"; exit;
  }

  // ожидание URL → валидируем → добавляем
  if ($st['mode'] === 'add_url'){
    $url = trim($text ?? '');
    if (!preg_match('~^https?://~i', $url)){
      sendMessage($chat_id, "Это не похоже на ссылку. Пришли корректный URL.");
      echo "ok"; exit;
    }
    $item = [
      'id'    => nextId($db['items']),
      'label' => $st['tmp']['label'],
      'url'   => $url,
      'pin'   => !empty($st['tmp']['pin'])
    ];
    array_unshift($db['items'], $item);
    $st = ['mode'=>null,'tmp'=>[]];
    saveDB($db);
    // опционально пушим наружу
    if ($PUSH_URL){
      @httpPost($PUSH_URL, ['event'=>'publish','item'=>$item,'token'=>hash('sha256',$url.$_SERVER['HTTP_HOST'])]);
    }
    sendMessage($chat_id, "Готово: «{$item['label']}» → {$item['url']}" . ($item['pin'] ? " 📌" : ""), [
      'reply_markup'=>kb_main(), 'disable_web_page_preview'=>true
    ]);
    echo "ok"; exit;
  }

  // ручные короткие команды с ID (совместимость)
  if (preg_match('~^/(pin|unpin|del|rename|edit)\b~', $text)){
    // оставляем как есть — но основной UX через кнопки в /list
  }

  // /list — вывод с инлайн‑кнопками
  if ($text === '/list'){
    $show = array_slice($db['items'], 0, 20);
    if (!$show){
      sendMessage($chat_id, "Список пуст. Нажми /add чтобы добавить.", ['reply_markup'=>kb_main()]);
      echo "ok"; exit;
    }
    foreach($show as $it){
      $kb = [
        'inline_keyboard'=>[
          [
            ['text'=> $it['pin'] ? 'Открепить 📌' : 'Закрепить 📌', 'callback_data'=>"pin:{$it['id']}"],
            ['text'=>'Переименовать ✏️', 'callback_data'=>"rename:{$it['id']}"],
          ],
          [
            ['text'=>'Изм. ссылку 🔗', 'callback_data'=>"edit:{$it['id']}"],
            ['text'=>'Удалить 🗑', 'callback_data'=>"del:{$it['id']}"]
          ]
        ]
      ];
      $title = ($it['pin']?'📌 ':'')."{$it['id']}. {$it['label']}\n{$it['url']}";
      sendMessage($chat_id, $title, [
        'reply_markup'=>json_encode($kb, JSON_UNESCAPED_UNICODE),
        'disable_web_page_preview'=>true
      ]);
    }
    echo "ok"; exit;
  }

  // завершение rename/edit (ожидание текста)
  if ($st['mode'] === 'rename_wait'){
    $id = $st['tmp']['id'];
    $i = getItemIndexById($db['items'], $id);
    if ($i>=0){ $db['items'][$i]['label'] = trim($text); saveDB($db); }
    $st = ['mode'=>null,'tmp'=>[]];
    sendMessage($chat_id, "Название обновлено ✅", ['reply_markup'=>kb_main()]);
    echo "ok"; exit;
  }
  if ($st['mode'] === 'edit_wait'){
    if (!preg_match('~^https?://~i', $text)){
      sendMessage($chat_id, "Это не URL, пришли корректную ссылку.");
      echo "ok"; exit;
    }
    $id = $st['tmp']['id'];
    $i = getItemIndexById($db['items'], $id);
    if ($i>=0){ $db['items'][$i]['url'] = trim($text); saveDB($db); }
    $st = ['mode'=>null,'tmp'=>[]];
    sendMessage($chat_id, "URL обновлён ✅", ['reply_markup'=>kb_main()]);
    echo "ok"; exit;
  }
}

/* ================== CALLBACK-КНОПКИ ================== */
if (isset($update['callback_query'])) {
  $cid = $chat_id;
  $cb  = $update['callback_query'];
  $data= $cb['data'] ?? '';
  [$cmd,$id] = array_pad(explode(':',$data,2),2,null);
  $id = (int)$id;

  if (in_array($cmd,['pin','rename','edit','del'], true)){
    $idx = getItemIndexById($db['items'], $id);
    if ($idx<0){ answerCallback($cb['id'], 'Не найдено'); echo "ok"; exit; }
  }

  if ($cmd==='pin'){
    $db['items'][$idx]['pin'] = !$db['items'][$idx]['pin'];
    saveDB($db);
    answerCallback($cb['id'], $db['items'][$idx]['pin']?'Закрепил':'Открепил');
    sendMessage($cid, ($db['items'][$idx]['pin']?'Закрепил':'Открепил')." «{$db['items'][$idx]['label']}»");
    echo "ok"; exit;
  }

  if ($cmd==='rename'){
    $db['states'][$cid] = ['mode'=>'rename_wait','tmp'=>['id'=>$id]];
    saveDB($db);
    answerCallback($cb['id'], 'Введи новый текст');
    sendMessage($cid, "Введи новый текст названия:", ['reply_markup'=>json_encode(['force_reply'=>true])]);
    echo "ok"; exit;
  }

  if ($cmd==='edit'){
    $db['states'][$cid] = ['mode'=>'edit_wait','tmp'=>['id'=>$id]];
    saveDB($db);
    answerCallback($cb['id'], 'Введи новый URL');
    sendMessage($cid, "Введи новый URL (http…):", ['reply_markup'=>json_encode(['force_reply'=>true])]);
    echo "ok"; exit;
  }

  if ($cmd==='del'){
    $removed = $db['items'][$idx]['label'];
    array_splice($db['items'], $idx, 1);
    saveDB($db);
    answerCallback($cb['id'], 'Удалено');
    sendMessage($cid, "Удалил «{$removed}»");
    echo "ok"; exit;
  }
}

echo "ok";
