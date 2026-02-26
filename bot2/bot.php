<?php
/* ===========================================================
   BUZHBA LINKS BOT — webhook версия (со стрелками ⬆️⬇️)
   =========================================================== */

$BOT_TOKEN = '8322392604:AAFboyOd4hyZBP83iaT79eq6UAB5rAFKX5E';
$ADMIN_ID  = 145661035;
$SECRET    = 'buzhba808506';

$ROOT      = __DIR__;
$DATA_FILE = dirname(__DIR__) . '/data.json'; // пишем в корневой файл
$BACKUP_DIR= $ROOT . '/data.backups';
$LOG_FILE  = $ROOT . '/bot.log';
$LOG_MAX   = 1024 * 1024;
$PUSH_URL  = null;

ini_set('display_errors', 0);
error_reporting(E_ALL);
if (!is_dir($BACKUP_DIR)) @mkdir($BACKUP_DIR, 0750, true);

function httpPost($url,$data){
  $ctx = stream_context_create(['http'=>[
    'method'=>'POST','header'=>"Content-Type: application/json",
    'content'=>json_encode($data, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)
  ]]); return file_get_contents($url,false,$ctx);
}
function tg($m,$p){ global $BOT_TOKEN; return httpPost("https://api.telegram.org/bot{$BOT_TOKEN}/{$m}",$p); }
function sendMessage($chat_id,$text,$opt=[]){ return tg('sendMessage', array_merge(['chat_id'=>$chat_id,'text'=>$text],$opt)); }
function answerCallback($id,$t=''){ return tg('answerCallbackQuery',['callback_query_id'=>$id,'text'=>$t,'show_alert'=>false]); }
function kb_main(){ return json_encode(['keyboard'=>[
  [ ['text'=>'/add'],['text'=>'/addp'] ],
  [ ['text'=>'/list'] ],
  [ ['text'=>'/up ID'],['text'=>'/down ID'] ],
  [ ['text'=>'/rename'],['text'=>'/edit'] ],
  [ ['text'=>'/pin'],['text'=>'/unpin'] ],
  [ ['text'=>'/del'] ],
], 'resize_keyboard'=>true], JSON_UNESCAPED_UNICODE); }
function logit($m){ global $LOG_FILE,$LOG_MAX; if (file_exists($LOG_FILE) && filesize($LOG_FILE)>$LOG_MAX) @rename($LOG_FILE,$LOG_FILE.'.1'); file_put_contents($LOG_FILE,"[".date('c')."] $m\n",FILE_APPEND); }

function loadDB(){
  global $DATA_FILE;
  if (!file_exists($DATA_FILE)){
    file_put_contents($DATA_FILE, json_encode(['title'=>'@buzhba — ссылки','items'=>[],'states'=>[]], JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES), LOCK_EX);
    @chmod($DATA_FILE, 0644);
  }
  $raw=@file_get_contents($DATA_FILE);
  return $raw? json_decode($raw,true) : ['title'=>'@buzhba — ссылки','items'=>[],'states'=>[]];
}
function saveDB($db){
  global $DATA_FILE,$BACKUP_DIR;
  if (file_exists($DATA_FILE)) @copy($DATA_FILE,$BACKUP_DIR.'/'.date('Ymd-His').'.json');
  $tmp=$DATA_FILE.'.tmp';
  file_put_contents($tmp, json_encode($db, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES), LOCK_EX);
  @chmod($tmp,0644);
  rename($tmp,$DATA_FILE);
}

/* -------- ХЕЛПЕРЫ СПИСКА -------- */
function nextId($items){ $max=0; foreach($items as $i){ $id=(int)($i['id']??0); if($id>$max)$max=$id; } return $max+1; }
function getItemIndexById(&$items,$id){ foreach($items as $k=>$v){ if((int)($v['id']??0)===(int)$id) return $k; } return -1; }
/* Переместить элемент на одну позицию внутри своей группы pin */
function moveWithinGroup(&$items,$id,$dir){ // $dir = 'up'|'down'
  $i=getItemIndexById($items,$id); if($i<0) return false;
  $pin=!empty($items[$i]['pin']);
  if($dir==='up'){
    for($j=$i-1;$j>=0;$j--){ if(!empty($items[$j]['pin'])===$pin){ $t=$items[$j]; $items[$j]=$items[$i]; $items[$i]=$t; return true; } }
  } else {
    for($j=$i+1;$j<count($items);$j++){ if(!empty($items[$j]['pin'])===$pin){ $t=$items[$j]; $items[$j]=$items[$i]; $items[$i]=$t; return true; } }
  }
  return false;
}

/* -------- ВЕБХУК-ЗАЩИТА -------- */
if (php_sapi_name()!=='cli'){ if (!isset($_GET['secret']) || $_GET['secret']!==$SECRET){ http_response_code(403); echo "forbidden"; exit; } }

/* -------- ПАРСИНГ UPDATE -------- */
$raw=file_get_contents('php://input'); if(!$raw){ echo "ok"; exit; }
logit($raw);
$update=json_decode($raw,true);
$msg=$update['message']??null; $cb=$update['callback_query']??null;
$chat_id=$msg['chat']['id']??($cb['message']['chat']['id']??null);
$text=$msg['text']??null; $caption=$msg['caption']??null;

$db=loadDB(); if(!isset($db['states']))$db['states']=[]; if($chat_id && !isset($db['states'][$chat_id])) $db['states'][$chat_id]=['mode'=>null,'tmp'=>[]];
$st=$chat_id? $db['states'][$chat_id] : ['mode'=>null,'tmp'=>[]];

/* =================== Сообщения =================== */
if($msg){
  $is_admin = ($msg['from']['id']==$ADMIN_ID);

  if($text==='/start'){
    sendMessage($chat_id,"Привет, Жорж!\n\n• /add — добавить\n• /addp — добавить и закрепить 📌\n• /list — показать список\n• /up ID /down ID — порядок\n• /rename /edit /pin /unpin /del",['reply_markup'=>kb_main()]);
    echo "ok"; exit;
  }

  if($text==='/setcmds' && $is_admin){
    tg('setMyCommands',['commands'=>[
      ['command'=>'add','description'=>'Добавить ссылку'],
      ['command'=>'addp','description'=>'Добавить и закрепить'],
      ['command'=>'list','description'=>'Показать список'],
      ['command'=>'up','description'=>'Поднять по ID'],
      ['command'=>'down','description'=>'Опустить по ID'],
      ['command'=>'rename','description'=>'Переименовать'],
      ['command'=>'edit','description'=>'Изменить URL'],
      ['command'=>'pin','description'=>'Закрепить'],
      ['command'=>'unpin','description'=>'Открепить'],
      ['command'=>'del','description'=>'Удалить'],
    ]]); sendMessage($chat_id,"Команды обновлены ✅",['reply_markup'=>kb_main()]); echo "ok"; exit;
  }

  if($text==='/add' || $text==='/addp'){
    $st['mode']=($text==='/addp')?'addp_title':'add_title'; $st['tmp']=['pin'=>($text==='/addp')];
    $db['states'][$chat_id]=$st; saveDB($db);
    sendMessage($chat_id,"Напиши название ссылки:",['reply_markup'=>json_encode(['force_reply'=>true])]); echo "ok"; exit;
  }

  if($st['mode']==='add_title' || $st['mode']==='addp_title'){
    $st['tmp']['label']=trim($text ?: $caption ?: ''); $st['mode']='add_url';
    $db['states'][$chat_id]=$st; saveDB($db);
    sendMessage($chat_id,"Теперь пришли URL (http…):",['reply_markup'=>json_encode(['force_reply'=>true])]); echo "ok"; exit;
  }

  if($st['mode']==='add_url'){
    $url=trim($text??''); if(!preg_match('~^https?://~i',$url)){ sendMessage($chat_id,"Это не похоже на ссылку. Пришли корректный URL."); echo "ok"; exit; }
    if(!isset($db['items']) || !is_array($db['items'])) $db['items']=[];
    $item=['id'=>nextId($db['items']),'label'=>$st['tmp']['label'] ?: $url,'url'=>$url,'pin'=>!empty($st['tmp']['pin'])];
    array_unshift($db['items'],$item);
    $db['states'][$chat_id]=['mode'=>null,'tmp'=>[]]; saveDB($db);
    sendMessage($chat_id,"Готово: «{$item['label']}» → {$item['url']}".($item['pin']?" 📌":""),['reply_markup'=>kb_main(),'disable_web_page_preview'=>true]); echo "ok"; exit;
  }

  if(preg_match('~^/up\s+(\d+)~i',$text,$m)){ $ok=moveWithinGroup($db['items'],(int)$m[1],'up'); saveDB($db); sendMessage($chat_id,$ok?"Поднял #{$m[1]} ↑":"Не удалось: уже верх."); echo "ok"; exit; }
  if(preg_match('~^/down\s+(\d+)~i',$text,$m)){ $ok=moveWithinGroup($db['items'],(int)$m[1],'down'); saveDB($db); sendMessage($chat_id,$ok?"Опустил #{$m[1]} ↓":"Не удалось: уже низ."); echo "ok"; exit; }

  if($text==='/list'){
    $items=$db['items'] ?? [];
    if(!$items){ sendMessage($chat_id,"Список пуст. Нажми /add.",['reply_markup'=>kb_main()]); echo "ok"; exit; }
    foreach(array_slice($items,0,20) as $it){
      $kb=['inline_keyboard'=>[
        [ ['text'=>'⬆️','callback_data'=>"up:{$it['id']}"], ['text'=>'⬇️','callback_data'=>"down:{$it['id']}"], ['text'=>!empty($it['pin'])?'Открепить 📌':'Закрепить 📌','callback_data'=>"pin:{$it['id']}"] ],
        [ ['text'=>'Переименовать ✏️','callback_data'=>"rename:{$it['id']}"], ['text'=>'Изм. ссылку 🔗','callback_data'=>"edit:{$it['id']}"], ['text'=>'Удалить 🗑','callback_data'=>"del:{$it['id']}"] ]
      ]];
      $title = (!empty($it['pin'])?'📌 ':'')."{$it['id']}. {$it['label']}\n{$it['url']}";
      sendMessage($chat_id,$title,['reply_markup'=>json_encode($kb,JSON_UNESCAPED_UNICODE),'disable_web_page_preview'=>true]);
    } echo "ok"; exit;
  }

  if(($db['states'][$chat_id]['mode'] ?? null)==='rename_wait'){
    $id=$db['states'][$chat_id]['tmp']['id']; $i=getItemIndexById($db['items'],$id); if($i>=0){ $db['items'][$i]['label']=trim($text); saveDB($db); }
    $db['states'][$chat_id]=['mode'=>null,'tmp'=>[]]; saveDB($db); sendMessage($chat_id,"Название обновлено ✅",['reply_markup'=>kb_main()]); echo "ok"; exit;
  }
  if(($db['states'][$chat_id]['mode'] ?? null)==='edit_wait'){
    if(!preg_match('~^https?://~i',$text)){ sendMessage($chat_id,"Это не URL, пришли корректную ссылку."); echo "ok"; exit; }
    $id=$db['states'][$chat_id]['tmp']['id']; $i=getItemIndexById($db['items'],$id); if($i>=0){ $db['items'][$i]['url']=trim($text); saveDB($db); }
    $db['states'][$chat_id]=['mode'=>null,'tmp'=>[]]; saveDB($db); sendMessage($chat_id,"URL обновлён ✅",['reply_markup'=>kb_main()]); echo "ok"; exit;
  }
}

/* =================== Callback-кнопки =================== */
if($cb){
  $cid=$chat_id; $data=$cb['data']??''; [$cmd,$rawId]=array_pad(explode(':',$data,2),2,null); $id=(int)$rawId;
  $items=&$db['items']; $idx = ($id && isset($items)) ? getItemIndexById($items,$id) : -1;

  if(in_array($cmd,['up','down','pin','rename','edit','del'],true) && $idx<0){ answerCallback($cb['id'],'Не найдено'); echo "ok"; exit; }

  if($cmd==='up' || $cmd==='down'){ $ok=moveWithinGroup($items,$id,$cmd); saveDB($db); answerCallback($cb['id'],$ok?($cmd==='up'?'Поднял ↑':'Опустил ↓'):'Дальше некуда'); echo "ok"; exit; }

  if($cmd==='pin'){ $items[$idx]['pin']=!empty($items[$idx]['pin'])?false:true; saveDB($db); answerCallback($cb['id'],!empty($items[$idx]['pin'])?'Закрепил':'Открепил'); sendMessage($cid,(!empty($items[$idx]['pin'])?'Закрепил':'Открепил')." «{$items[$idx]['label']}»"); echo "ok"; exit; }

  if($cmd==='rename'){ $db['states'][$cid]=['mode'=>'rename_wait','tmp'=>['id'=>$id]]; saveDB($db); answerCallback($cb['id'],'Введи новый текст'); sendMessage($cid,"Введи новый текст названия:",['reply_markup'=>json_encode(['force_reply'=>true])]); echo "ok"; exit; }

  if($cmd==='edit'){ $db['states'][$cid]=['mode'=>'edit_wait','tmp'=>['id'=>$id]]; saveDB($db); answerCallback($cb['id'],'Введи новый URL'); sendMessage($cid,"Введи новый URL (http…):",['reply_markup'=>json_encode(['force_reply'=>true])]); echo "ok"; exit; }

  if($cmd==='del'){ $name=$items[$idx]['label']; array_splice($items,$idx,1); saveDB($db); answerCallback($cb['id'],'Удалено'); sendMessage($cid,"Удалил «{$name}»"); echo "ok"; exit; }
}

echo "ok";
