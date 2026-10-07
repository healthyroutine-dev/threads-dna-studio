import asyncio, ssl, sys
import edge_tts, edge_tts.communicate as c, edge_tts.voices as v
ctx = ssl.create_default_context(cafile="/root/.ccr/ca-bundle.crt")
c._SSL_CTX = ctx
if hasattr(v, "_SSL_CTX"): v._SSL_CTX = ctx
async def main(voice, text, out, rate="+0%"):
    await edge_tts.Communicate(text, voice, rate=rate).save(out)
asyncio.run(main(*sys.argv[1:]))
