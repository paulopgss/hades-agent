/**
 * Script de diagnóstico: lista os modelos disponíveis para sua API key
 * que suportam bidiGenerateContent (Gemini Live API).
 * 
 * Uso: node scripts/list-live-models.js
 */

const https = require('https');
const path = require('path');

// Tenta carregar a API key do store
let apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
  // Tenta ler do settings.json (criptografado), fallback para .env
  try {
    const fs = require('fs');
    const os = require('os');
    const crypto = require('crypto');
    const { app } = require('electron');
    // Se não estiver em contexto Electron, tenta via userData padrão
    const userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'hades-agent');
    const settingsPath = path.join(userDataPath, 'settings.json');
    if (fs.existsSync(settingsPath)) {
      const raw = fs.readFileSync(settingsPath, 'utf8').trim();
      // Tenta parsear como JSON simples
      try {
        const parsed = JSON.parse(raw);
        apiKey = parsed?.general?.apiKey;
      } catch {
        // Provavelmente criptografado, tenta decriptar
        const username = os.userInfo().username || 'hades';
        const key = crypto.scryptSync(username, 'hades-salt-secure', 32);
        const parts = raw.split(':');
        const iv = Buffer.from(parts.shift(), 'hex');
        const encryptedText = Buffer.from(parts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let dec = decipher.update(encryptedText, 'hex', 'utf8');
        dec += decipher.final('utf8');
        const parsed = JSON.parse(dec);
        apiKey = parsed?.general?.apiKey;
      }
    }
  } catch (e) {
    // Ignora erros de leitura do store
  }
}

if (!apiKey) {
  console.error('❌ API key não encontrada. Passe via variável de ambiente:');
  console.error('   $env:GEMINI_API_KEY="sua-key" && node scripts/list-live-models.js');
  process.exit(1);
}

console.log(`✓ API Key encontrada (length: ${apiKey.length})`);
console.log('📡 Consultando modelos disponíveis em v1beta...\n');

const options = {
  hostname: 'generativelanguage.googleapis.com',
  path: `/v1beta/models?key=${apiKey}&pageSize=100`,
  method: 'GET'
};

https.get(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.error) {
        console.error('❌ Erro da API:', parsed.error.message);
        return;
      }
      const models = parsed.models || [];
      const liveModels = models.filter(m => 
        m.supportedGenerationMethods?.includes('bidiGenerateContent')
      );

      console.log(`Total de modelos: ${models.length}`);
      console.log(`Modelos com bidiGenerateContent: ${liveModels.length}\n`);
      
      if (liveModels.length === 0) {
        console.log('⚠️  Nenhum modelo com suporte a bidiGenerateContent encontrado.');
        console.log('    Isso pode indicar que sua API key é de tier gratuito ou não tem acesso ao Live API.\n');
        console.log('Todos os modelos disponíveis:');
        models.forEach(m => console.log(`  - ${m.name} [${m.supportedGenerationMethods?.join(', ')}]`));
      } else {
        console.log('✅ Modelos compatíveis com o Gemini Live API:');
        liveModels.forEach(m => {
          console.log(`  📌 ${m.name}`);
          console.log(`     Display: ${m.displayName}`);
          console.log(`     Version: ${m.version}`);
          console.log(`     Methods: ${m.supportedGenerationMethods?.join(', ')}`);
          console.log('');
        });
      }
    } catch(e) {
      console.error('❌ Erro ao parsear resposta:', e.message);
      console.error('Resposta raw:', data.substring(0, 500));
    }
  });
}).on('error', (e) => {
  console.error('❌ Erro de rede:', e.message);
});
