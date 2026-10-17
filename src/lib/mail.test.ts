import assert from "node:assert/strict";
import test from "node:test";
import { creatorNoticeMessage, creatorWelcomeMessage } from "./mail.ts";

test("welcome mail includes the dashboard link, username, password, and encouragement", () => {
  const message = creatorWelcomeMessage({
    name: "Болд Дорж",
    username: "bold",
    password: "secret-pass",
    loginLink: "https://cinemafeel.dev/admin/login",
    ready: true,
  });
  assert.equal(message.subject, "CinemaFeel дашбоард нээгдлээ");
  assert.match(message.text, /Нэвтрэх нэр: bold/);
  assert.match(message.text, /Нууц үг: secret-pass/);
  assert.match(message.text, /https:\/\/cinemafeel\.dev\/admin\/login/);
  assert.match(message.text, /Эхний богино түүхээ/);
  assert.match(message.html, /secret-pass/);
  assert.doesNotMatch(message.html, /<script/i);
});

test("welcome mail tells unpaid creators to wait for payment", () => {
  const message = creatorWelcomeMessage({
    name: "Сараа",
    username: "saraa",
    password: "another-pass",
    loginLink: "https://cinemafeel.dev/admin/login",
    ready: false,
  });
  assert.match(message.text, /Төлбөр баталгаажмагц/);
  assert.match(message.text, /Нууц үг: another-pass/);
});

test("creator notice is email copy for viewers and hides credentials", () => {
  const message = creatorNoticeMessage({
    name: "Болд Дорж",
    corner: "Шөнийн булан",
    contentType: "Драма",
    link: "https://cinemafeel.dev/c/bold",
  });
  assert.match(message.subject, /Шөнийн булан/);
  assert.match(message.text, /CinemaFeel-д нэгдлээ/);
  assert.match(message.text, /https:\/\/cinemafeel\.dev\/c\/bold/);
  assert.match(message.text, /Драма/);
  assert.doesNotMatch(message.text, /Нууц үг/);
  assert.doesNotMatch(message.html, /password/i);
});
