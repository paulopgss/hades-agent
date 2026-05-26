const { GoogleGenAI } = require('@google/genai');
const logger = require('./logger');

/**
 * GeminiLiveService manages the real-time session to Gemini's Multimodal Live API
 * using the official @google/genai SDK.
 */
class GeminiLiveService {
  /** @type {any} */
  session = null;
  /** @type {any} */
  client = null;
  
  isReady = false;
  chunkCount = 0;
  _notifiedWaiting = false;

  // Latency tracking
  lastChunkTime = 0;
  turnStartTime = 0;

  /**
   * Starts the Gemini Live session.
   * @param {Object} event - The Electron IPC event.
   * @param {string} personaPrompt - The persona instruction for the model.
   * @returns {Promise<boolean>}
   */
  async start(event, personaPrompt, isSuggestionsMode = false) {
    if (this.session) {
      this.stop();
    }

    const jsonStore = require('../store/jsonStore');
    const apiKey = jsonStore.getSettings().general.apiKey || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      logger.error('GEMINI LIVE', 'API Key missing.');
      throw new Error("API Key missing");
    }

    this.isReady = false;
    this.chunkCount = 0;
    this._notifiedWaiting = false;
    this.turnStartTime = 0;
    this.isSuggestionsMode = isSuggestionsMode;

    return new Promise((resolve) => {
      (async () => {
        try {
          this.client = new GoogleGenAI({ apiKey });
          
          const model = "models/gemini-2.5-flash-native-audio-latest";

          logger.info('GEMINI LIVE', `Connecting to session for model: ${model}`);
          
          event.sender.send('susurro-live-status', 'connecting');

          this.session = await this.client.live.connect({
            model: model,
            config: {
              responseModalities: ["AUDIO"],
              systemInstruction: {
                parts: [{ 
                  text: isSuggestionsMode 
                    ? (personaPrompt || "Você está no modo de Insights. Pare de transcrever o áudio do usuário e em vez disso, ouça suas perguntas ou falas e dê sugestões, respostas e insights. Seja conciso mas útil, nada muito longo porem não pouco, o suficiente apenas. Responda DIRETAMENTE ao que o usuário disser. NUNCA narre seus pensamentos internos ou planejamento (ex: 'I am now focusing on...'). Entregue apenas a resposta final.")
                    : (personaPrompt || "VOCÊ É UM TRANSRITOR DE ÁUDIO DE ALTA PRECISÃO. REGRA ABSOLUTA: Transcreva EXATAMENTE o que é dito no áudio. NÃO responda, NÃO comente, NÃO gere 'Model Text'. Sua ÚNICA função é fornecer a transcrição via canal de input_audio_transcription. MANTENHA SILÊNCIO TOTAL NO CANAL DE RESPOSTA (AUDIO E TEXTO).")
                }]
              },
              inputAudioTranscription: { enabled: true },
              outputAudioTranscription: { enabled: true }
            },
            callbacks: {
              onopen: () => {
                logger.info('GEMINI LIVE', 'Session handshake complete. Ready for audio.');
                this.isReady = true;
                event.sender.send('susurro-live-status', 'ready');
              },
              onmessage: (msg) => {
                this.handleServerMessage(msg, event);
              },
              onerror: (err) => {
                logger.error('GEMINI LIVE', 'Session error encountered:', err);
                event.sender.send('susurro-live-status', 'error');
                resolve(false);
              },
              onclose: (e) => {
                logger.info('GEMINI LIVE', `Session closed by server. Code: ${e.code}, Reason: ${e.reason || 'None'}`);
                event.sender.send('susurro-live-status', 'closed');
                this.session = null;
                this.isReady = false;
                resolve(false);
              }
            }
          });

          resolve(true);

        } catch (err) {
          logger.error('GEMINI LIVE', 'Critical failure during session initialization:', err);
          event.sender.send('susurro-live-status', 'error');
          this.session = null;
          this.isReady = false;
          resolve(false);
        }
      })();
    });
  }
  
  /**
   * Handles incoming messages from the SDK session.
   * @private
   */
  handleServerMessage(msg, event) {
    try {
      if (!msg) return;

      if (msg.setupComplete) {
        logger.info('GEMINI LIVE', 'Setup Complete (Server Acknowledged Config)');
      }

      if (msg.serverContent) {
        const fs = require('node:fs');
        const path = require('node:path');
        const logPath = path.join(process.cwd(), 'gemini_live_payloads.log');
        fs.appendFileSync(logPath, `\n\n--- PAYLOAD AT ${new Date().toISOString()} ---\n${JSON.stringify(msg, null, 2)}`);
        
        this.processServerContent(msg.serverContent, event);
      }
    } catch (e) {
      logger.error('GEMINI LIVE', 'Error processing message', e);
    }
  }

  processModelTurn(modelTurn, event) {
    if (!modelTurn?.parts) return;
    for (const part of modelTurn.parts) {
      if (part.text && !part.thought) {
        event.sender.send('susurro-live-delta', { 
          text: part.text, 
          isFinal: false 
        });
      }
    }
  }

  processServerContent(serverContent, event) {
    const now = Date.now();

    // 1. Check for input audio transcription (user talking)
    const inputTranscription = serverContent.inputTranscription;
    if (inputTranscription && !this.isSuggestionsMode) {
      this.processInputTranscription(inputTranscription, event, now);
    }

    // 2. Output transcription (model talking)
    if (this.isSuggestionsMode) {
      this.processModelTurn(serverContent.modelTurn, event);
      
      if (serverContent.outputTranscription?.text) {
        event.sender.send('susurro-live-delta', { 
          text: serverContent.outputTranscription.text, 
          isFinal: false 
        });
      }
    }

    // 4. Check for explicit turn completion
    if (serverContent.turnComplete) {
      const turnDuration = this.turnStartTime ? now - this.turnStartTime : 'N/A';
      logger.info('GEMINI LIVE', `[TURN COMPLETE] End-to-end time: ${turnDuration}ms`);
      this.turnStartTime = 0;
      event.sender.send('susurro-live-delta', { 
        text: '', 
        isFinal: true 
      });
    }
  }

  processInputTranscription(inputTranscription, event, now) {
    if (!this.turnStartTime) this.turnStartTime = now;
    
    const latency = now - this.lastChunkTime;
    logger.info('GEMINI LIVE', `[INPUT] "${inputTranscription.text}" (Latency: ${latency}ms, Finished: ${inputTranscription.finished})`);
    
    if (inputTranscription.text) {
      event.sender.send('susurro-live-delta', { 
        text: inputTranscription.text, 
        isFinal: inputTranscription.finished || false 
      });
    }

    if (inputTranscription.finished) {
      const turnDuration = now - this.turnStartTime;
      logger.info('GEMINI LIVE', `[INPUT COMPLETE] Total turn time: ${turnDuration}ms`);
      this.turnStartTime = 0;
    }
  }

  /**
   * Sends a base64 encoded audio chunk to the model.
   * @param {string} base64Audio 
   */
  sendChunk(base64Audio) {
    if (this.session && this.isReady) {
      this.chunkCount++;
      this.lastChunkTime = Date.now();

      if (this.chunkCount % 50 === 1) {
        logger.info('GEMINI LIVE', `Sending audio chunk #${this.chunkCount}`);
      }

      try {
        this.session.sendRealtimeInput({
          media: {
            data: base64Audio,
            mimeType: "audio/pcm;rate=16000"
          }
        });
      } catch (err) {
        logger.error('GEMINI LIVE', 'Failed to send audio chunk:', err);
      }
    } else if (!this.isReady && !this._notifiedWaiting) {
      logger.warn('GEMINI LIVE', 'Audio chunk received but session not ready. Waiting for handshake...');
      this._notifiedWaiting = true;
    }
  }

  /**
   * Closes the active session.
   */
  stop() {
    this.isReady = false;
    this._notifiedWaiting = false;
    this.turnStartTime = 0;
    if (this.session) {
      try {
        if (typeof this.session.close === 'function') {
          this.session.close();
        }
      } catch (e) {
        logger.error('GEMINI LIVE', 'Error closing session', e);
      }
      this.session = null;
    }
  }
}

module.exports = new GeminiLiveService();
