/**
 * Docker Desktop (and some Linux hosts) can resolve OpenRouter to IPv6 first.
 * Node's happy-eyeballs connect then hangs with ETIMEDOUT while wget/curl work.
 * Prefer IPv4 before any outbound OpenAI/OpenRouter calls.
 */
import dns from 'dns';
import net from 'net';

dns.setDefaultResultOrder('ipv4first');
if (typeof net.setDefaultAutoSelectFamily === 'function') {
  net.setDefaultAutoSelectFamily(false);
}
