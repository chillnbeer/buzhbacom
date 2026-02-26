<?php
/* ====== НАСТРОЙКИ ====== */
$BOT_TOKEN      = '8284658176:AAEsaHv1TgyLCFHujcSGgqZkBuwTYxWdZ_M';     // токен НОВОГО бота от @BotFather
$ADMIN_IDS      = [145661035];               // твой Telegram ID; можно несколько: [145..., 123...]
$WEBHOOK_SECRET = 'buzhba808506';  // любой сложный секрет для URL
$GEN_URL        = 'https://buzhba.com/generator.php';
$GEN_SECRET     = 'buzhba808506';  // тот же, что в generator.php

/* ====== ФАЙЛЫ ЭТОГО БОТА (чтоб не конфликтовать со старым) ====== */
$LOG_FILE       = __DIR__ . '/bot_release.log';
$STATE_FILE     = __DIR__ . '/data.release.state.json';

ini_set('display_errors', 0);
error_reporting(E_ALL);

/* ====== УТИЛИТЫ ====== */
function logmsg($m){ global $LOG_FILE; file_put_contents($LOG_FILE, date('[Y-m-d H:i:s] ').$m."\n", FILE_APPEND); }

function tgApi($method, $params=[]){
  global $BOT_TOKEN;
  $ch = curl_init('https://api.telegram.org/bot'.$BOT_TOKEN.'/'.$method);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER=>true,
    CURLOPT_POST=>true,
    CURLOPT_POSTFIELDS=>$params,
    CURLOPT_TIMEOUT=>25,
  ]);
  $resp = curl_exec($ch);
  if($resp===false){ $resp=''; }
  curl_close($ch);
  return json_decode($resp, true);
}

function sendMessage($chat_id,$text,$mode=null){
  $p=['chat_id'=>$chat_id,'text'=>$text];
  if($mode) $p['parse_mode']=$mode;
  return tgApi('sendMessage',$p);
}

function getFilePath($file_id){
  $j = tgApi('getFile', ['file_id'=>$file_id]);
  return $j['ok'] ? ($j['result']['file_path'] ?? '') : '';
}

function loadState(){
  global $STATE_FILE;
  if(!file_exists($STATE_FILE)) return [];
  $j = json_decode(file_get_contents($STATE_FILE), true);
  return is_array($j)?$j:[];
}
function saveState($state){
  global $STATE_FILE;
  file_put_contents($STATE_FILE, json_encode($state, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT | JSON_INVALID_UTF8_SUBSTITUTE));
}

/* ====== ПРОСТОЕ HEALTHCHECK ====== */
if (($_GET['health'] ?? '') === '1') { header('Content-Type: text/plain'); echo "ok\n"; exit; }

/* ====== ПРОВЕРКА СЕКРЕТА В URL ====== */
if (($_GET['secret'] ?? '') !== $WEBHOOK_SECRET) { http_response_code(403); echo 'forbidden'; exit; }

/* ====== ЧТЕНИЕ UPDATE ====== */
$raw = file_get_contents('php://input');
if (!$raw) { echo 'ok'; exit; }
$update = json_decode($raw, true);
if (!$update) { echo 'ok'; exit; }

$state = loadState();

$chat_id = $update['message']['chat']['id'] ?? $update['callback_query']['message']['chat']['id'] ?? null;
$from_id = $update['message']['from']['id'] ?? $update['callback_query']['from']['id'] ?? null;
$text    = trim($update['message']['text'] ?? '');

/* ====== ДОСТУП ====== */
if (!in_array($from_id, $ADMIN_IDS, true)) {
  if($chat_id) sendMessage($chat_id, "Прости, этот бот только для Жоржа.");
  echo 'ok'; exit;
}

/* ====== КОМАНДЫ ====== */
if ($text === '/start') {
  sendMessage($chat_id, "Йо! Я делаю страницы релизов.\nКоманды:\n/newrelease — новый релиз\n/cancel — отмена");
  echo 'ok'; exit;
}

if ($text === '/cancel') {
  unset($state[$chat_id]); saveState($state);
  sendMessage($chat_id, "Окей, отменил.");
  echo 'ok'; exit;
}

if ($text === '/newrelease') {
  $state[$chat_id] = ['step'=>'title','links'=>[]];
  saveState($state);
  sendMessage($chat_id, "Кинь *название трека*.", 'Markdown');
  echo 'ok'; exit;
}

/* ====== СЦЕНАРИЙ НОВОГО РЕЛИЗА ====== */
if (isset($state[$chat_id])) {
  $st = &$state[$chat_id];

  switch ($st['step']) {
    case 'title':
      if ($text !== '') {
        $st['title'] = $text;
        $st['step'] = 'cover';
        saveState($state);
        sendMessage($chat_id, "Теперь пришли *обложку* (фото/файл), или напиши `skip`.", 'Markdown');
      }
      break;

    case 'cover':
      if ($text && strtolower($text) === 'skip') {
        $st['cover_url'] = null;
        $st['step'] = 'links';
        saveState($state);
        sendMessage($chat_id, "Окей. Пришли ссылки *по одной строке* так:\n`Название — https://...`\nЗавершить — `/done`.", 'Markdown');
      } elseif (!empty($update['message']['photo'])) {
        $photos = $update['message']['photo'];
        $file_id = end($photos)['file_id'];
        $path = getFilePath($file_id);
        $st['cover_url'] = $path ? ('https://api.telegram.org/file/bot'.$BOT_TOKEN.'/'.$path) : null;
        $st['step'] = 'links';
        saveState($state);
        sendMessage($chat_id, "Принял обложку. Теперь ссылки:\n`Название — https://...`\nЗавершить — `/done`.", 'Markdown');
      } elseif (!empty($update['message']['document'])) {
        $file_id = $update['message']['document']['file_id'];
        $path = getFilePath($file_id);
        $st['cover_url'] = $path ? ('https://api.telegram.org/file/bot'.$BOT_TOKEN.'/'.$path) : null;
        $st['step'] = 'links';
        saveState($state);
        sendMessage($chat_id, "Принял файл‑обложку. Теперь ссылки:\n`Название — https://...`\nЗавершить — `/done`.", 'Markdown');
      } else {
        sendMessage($chat_id, "Не вижу картинку. Пришли фото/файл или напиши `skip`.");
      }
      break;

    case 'links':
      if ($text === '/done') {
        if (empty($st['links'])) {
          sendMessage($chat_id, "Нужна хотя бы одна ссылка. Формат: `Название — https://...`", 'Markdown');
        } else {
          $st['step'] = 'slug';
          saveState($state);
          sendMessage($chat_id, "Выбери адрес (slug), например `song` → https://buzhba.com/song");
        }
      } elseif ($text) {
        if (strpos($text, 'http') !== false) {
          $parts = preg_split('~—|-|:~u', $text, 2);
          if (count($parts) === 2) {
            $name = trim($parts[0]); $url = trim($parts[1]);
            $st['links'][] = ['name'=>$name, 'url'=>$url];
            saveState($state);
            sendMessage($chat_id, "Добавил: *{$name}* → {$url}\nПрисылай ещё или `/done`.", 'Markdown');
          } else {
            sendMessage($chat_id, "Формат ровно такой: `Название — https://...`", 'Markdown');
          }
        } else {
          sendMessage($chat_id, "Добавь линк с `http(s)`.");
        }
      }
      break;

    case 'slug':
      if ($text) {
        $slug = trim($text);
        $payload = [
          'title'       => $st['title'],
          'slug'        => $slug,
          'description' => '',
          'date'        => date('Y-m-d'),
          'links'       => $st['links'],
          'cover_url'   => $st['cover_url'] ?? null,
        ];

        // POST в генератор
        $ch = curl_init($GEN_URL);
        curl_setopt_array($ch, [
          CURLOPT_POST=>true,
          CURLOPT_HTTPHEADER=>['Content-Type: application/json','X-Auth: '.$GEN_SECRET],
          CURLOPT_POSTFIELDS=>json_encode($payload, JSON_UNESCAPED_UNICODE),
          CURLOPT_RETURNTRANSFER=>true,
          CURLOPT_TIMEOUT=>25
        ]);
        $resp = curl_exec($ch);
        $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        unset($state[$chat_id]); saveState($state);

        if ($http===200) {
          $j = json_decode($resp, true);
          $url = $j['url'] ?? ('https://buzhba.com/'.$slug);
          sendMessage($chat_id, "Готово! Страница: ".$url);
        } else {
          sendMessage($chat_id, "Не вышло (HTTP {$http}). Ответ: ".$resp);
        }
      }
      break;
  }
  echo 'ok'; exit;
}

echo 'ok';
