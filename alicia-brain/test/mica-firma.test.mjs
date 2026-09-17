import { test } from "node:test";
import assert from "node:assert/strict";
import { firmaValida } from "../src/mica/wa.js";

// Vector verificado contra el SDK oficial de Twilio: se instaló `twilio` en el worktree,
// se corrió twilio.getExpectedTwilioSignature(TOKEN, URL, PARAMS) y esta es su salida.
// (La dependencia se sacó después: no vale arrastrar el SDK entero por una constante.)
const URL = "https://mycompany.com/myapp.php?foo=1&bar=2";
const PARAMS = {
  Digits: "1234", To: "+18005551212", From: "+14158675310",
  Caller: "+14158675310", CallSid: "CA1234567890ABCDE",
};
const TOKEN = "12345";
const FIRMA_OK = "GvWf1cFY/Q7PnoempGyD5oXAezc=";

test("acepta la firma correcta de Twilio", () => {
  assert.equal(firmaValida({ url: URL, params: PARAMS, firma: FIRMA_OK, token: TOKEN }), true);
});

test("rechaza una firma alterada", () => {
  assert.equal(firmaValida({ url: URL, params: PARAMS, firma: "XXXXXcFY/Q7PnoempGyD5oXAezc=", token: TOKEN }), false);
});

test("rechaza si alguien cambió un parámetro", () => {
  const manipulado = { ...PARAMS, Digits: "9999" };
  assert.equal(firmaValida({ url: URL, params: manipulado, firma: FIRMA_OK, token: TOKEN }), false);
});

test("sin firma no pasa — el default es rechazar, nunca dejar entrar", () => {
  assert.equal(firmaValida({ url: URL, params: PARAMS, firma: "", token: TOKEN }), false);
  assert.equal(firmaValida({ url: URL, params: PARAMS, firma: undefined, token: TOKEN }), false);
});
