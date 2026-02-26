<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Получаем данные из формы
    $name = $_POST['name'];
    $email = $_POST['email'];
    $message = $_POST['message'];

    // Устанавливаем email для отправки
    $to = "chillnbeer@gmail.com"; // Замените на свой адрес
    $subject = "Сообщение от $name";
    $body = "Имя: $name\nEmail: $email\n\nСообщение:\n$message";

    // Заголовки письма
    $headers = "From: $email";

    // Отправляем письмо
    if (mail($to, $subject, $body, $headers)) {
        echo "<script>alert('Сообщение отправлено успешно!'); window.location.href = 'https://buzhba.com/';</script>";
        exit();
    } else {
        echo "Ошибка при отправке сообщения.";
    }
}
?>
