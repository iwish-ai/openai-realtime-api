import { RealtimeEventHandler } from './event_handler.js';
import { RealtimeAPI } from './api.js';
import { RealtimeConversation } from './conversation.js';
import { RealtimeUtils } from './utils.js';

/**
 * Valid audio formats
 * @typedef {"pcm16"|"g711_ulaw"|"g711_alaw"} AudioFormatType
 */

/**
 * @typedef {Object} AudioTranscriptionType
 * @property {"whisper-1"} model
 */

/**
 * @typedef {Object} TurnDetectionServerVadType
 * @property {"server_vad"} type
 * @property {number} [threshold]
 * @property {number} [prefix_padding_ms]
 * @property {number} [silence_duration_ms]
 */

/**
 * Tool definitions
 * @typedef {Object} ToolDefinitionType
 * @property {"function"} [type]
 * @property {string} name
 * @property {string} description
 * @property {{[key: string]: any}} parameters
 */

/**
 * @typedef {Object} SessionResourceType
 * @property {string} [model]
 * @property {string[]} [modalities]
 * @property {string} [instructions]
 * @property {"alloy"|"ash"|"ballad"|"coral"|"echo"|"sage"|"shimmer"|"verse"} [voice]
 * @property {AudioFormatType} [input_audio_format]
 * @property {AudioFormatType} [output_audio_format]
 * @property {AudioTranscriptionType|null} [input_audio_transcription]
 * @property {TurnDetectionServerVadType|null} [turn_detection]
 * @property {ToolDefinitionType[]} [tools]
 * @property {"auto"|"none"|"required"|{type:"function",name:string}} [tool_choice]
 * @property {number} [temperature]
 * @property {number|"inf"} [max_response_output_tokens]
 */

/**
 * @typedef {"in_progress"|"completed"|"incomplete"} ItemStatusType
 */

/**
 * @typedef {Object} InputTextContentType
 * @property {"input_text"} type
 * @property {string} text
 */

/**
 * @typedef {Object} InputAudioContentType
 * @property {"input_audio"} type
 * @property {string} [audio] base64-encoded audio data
 * @property {string|null} [transcript]
 */

/**
 * @typedef {Object} TextContentType
 * @property {"text"} type
 * @property {string} text
 */

/**
 * @typedef {Object} AudioContentType
 * @property {"audio"} type
 * @property {string} [audio] base64-encoded audio data
 * @property {string|null} [transcript]
 */

/**
 * @typedef {Object} SystemItemType
 * @property {string|null} [previous_item_id]
 * @property {"message"} type
 * @property {ItemStatusType} status
 * @property {"system"} role
 * @property {Array<InputTextContentType>} content
 */

/**
 * @typedef {Object} UserItemType
 * @property {string|null} [previous_item_id]
 * @property {"message"} type
 * @property {ItemStatusType} status
 * @property {"user"} role
 * @property {Array<InputTextContentType|InputAudioContentType>} content
 */

/**
 * @typedef {Object} AssistantItemType
 * @property {string|null} [previous_item_id]
 * @property {"message"} type
 * @property {ItemStatusType} status
 * @property {"assistant"} role
 * @property {Array<TextContentType|AudioContentType>} content
 */

/**
 * @typedef {Object} FunctionCallItemType
 * @property {string|null} [previous_item_id]
 * @property {"function_call"} type
 * @property {ItemStatusType} status
 * @property {string} call_id
 * @property {string} name
 * @property {string} arguments
 */

/**
 * @typedef {Object} FunctionCallOutputItemType
 * @property {string|null} [previous_item_id]
 * @property {"function_call_output"} type
 * @property {string} call_id
 * @property {string} output
 */

/**
 * @typedef {Object} FormattedToolType
 * @property {"function"} type
 * @property {string} name
 * @property {string} call_id
 * @property {string} arguments
 */

/**
 * @typedef {Object} FormattedPropertyType
 * @property {Int16Array} [audio]
 * @property {string} [text]
 * @property {string} [transcript]
 * @property {FormattedToolType} [tool]
 * @property {string} [output]
 * @property {any} [file]
 */

/**
 * @typedef {Object} FormattedItemType
 * @property {string} id
 * @property {string} object
 * @property {"user"|"assistant"|"system"} [role]
 * @property {FormattedPropertyType} formatted
 */

/**
 * @typedef {SystemItemType|UserItemType|AssistantItemType|FunctionCallItemType|FunctionCallOutputItemType} BaseItemType
 */

/**
 * @typedef {FormattedItemType & BaseItemType} ItemType
 */

/**
 * @typedef {Object} IncompleteResponseStatusType
 * @property {"incomplete"} type
 * @property {"interruption"|"max_output_tokens"|"content_filter"} 
 */

/**
 * @typedef {Object} FailedResponseStatusType
 * @property {"failed"} type
 * @property {{code: string, message: string}|null} error
 */

/**
 * @typedef {Object} UsageType
 * @property {number} total_tokens
 * @property {number} input_tokens
 * @property {number} output_tokens
 */

/**
 * @typedef {Object} ResponseResourceType
 * @property {"in_progress"|"completed"|"incomplete"|"cancelled"|"failed"} status
 * @property {IncompleteResponseStatusType|FailedResponseStatusType|null} status_details
 * @property {ItemType[]} output
 * @property {UsageType|null} usage
 */

/**
 * RealtimeClient Class
 * @class
 */
export class RealtimeClient extends RealtimeEventHandler {
  /**
   * Create a new RealtimeClient instance
   * @param {{url?: string, apiKey?: string, dangerouslyAllowAPIKeyInBrowser?: boolean, debug?: boolean}} [settings]
   */
  constructor({ url, apiKey, dangerouslyAllowAPIKeyInBrowser, debug } = {}) {
    super();
    this.defaultSessionConfig = {
      type: 'realtime',
      instructions: '',
      audio: {
        input: {
          format: { type: 'audio/pcm', rate: 24000 },
        },
        output: {
          format: { type: 'audio/pcm', rate: 24000 },
          voice: 'verse',
        },
      },
      tools: [],
    };
    this.sessionConfig = {};
    this.transcriptionModels = [
      {
        model: 'whisper-1',
      },
    ];
    this.defaultServerVadConfig = {
      type: 'server_vad',
      threshold: 0.7, // 0.0 to 1.0 — higher = less sensitive to background noise
      prefix_padding_ms: 300, // How much audio to include in the audio stream before the speech starts.
      silence_duration_ms: 350, // How long to wait to mark the speech as stopped.
    };
    this.realtime = new RealtimeAPI({
      url,
      apiKey,
      dangerouslyAllowAPIKeyInBrowser,
      debug,
    });
    this.conversation = new RealtimeConversation();
    this._resetConfig();
    this._addAPIEventHandlers();
  }

  /**
   * Resets sessionConfig and conversationConfig to default
   * @private
   * @returns {true}
   */
  _resetConfig() {
    this.sessionCreated = false;
    this.tools = {};
    this.sessionConfig = JSON.parse(JSON.stringify(this.defaultSessionConfig));
    this.inputAudioBuffer = new Int16Array(0);
    return true;
  }

  /**
   * Sets up event handlers for a fully-functional application control flow
   * @private
   * @returns {true}
   */
  _addAPIEventHandlers() {
    // Event Logging handlers
    this.realtime.on('client.*', (event) => {
      const realtimeEvent = {
        time: new Date().toISOString(),
        source: 'client',
        event: event,
      };
      this.dispatch('realtime.event', realtimeEvent);
    });
    this.realtime.on('server.*', (event) => {
      const realtimeEvent = {
        time: new Date().toISOString(),
        source: 'server',
        event: event,
      };
      this.dispatch('realtime.event', realtimeEvent);
    });

    // Handles session created event, can optionally wait for it
    this.realtime.on(
      'server.session.created',
      () => (this.sessionCreated = true),
    );

    // Setup for application control flow
    const handler = (event, ...args) => {
      const { item, delta } = this.conversation.processEvent(event, ...args);
      return { item, delta };
    };
    const handlerWithDispatch = (event, ...args) => {
      const { item, delta } = handler(event, ...args);
      if (item) {
        // FIXME: If statement is only here because item.input_audio_transcription.completed
        //        can fire before `item.created`, resulting in empty item.
        //        This happens in VAD mode with empty audio
        this.dispatch('conversation.updated', { item, delta });
      }
      return { item, delta };
    };
    const callTool = async (tool) => {
      try {
        const jsonArguments = JSON.parse(tool.arguments);
        const toolConfig = this.tools[tool.name];
        if (!toolConfig) {
          throw new Error(`Tool "${tool.name}" has not been added`);
        }
        const result = await toolConfig.handler(jsonArguments);
        this.realtime.send('conversation.item.create', {
          item: {
            type: 'function_call_output',
            call_id: tool.call_id,
            output: JSON.stringify(result),
          },
        });
      } catch (e) {
        this.realtime.send('conversation.item.create', {
          item: {
            type: 'function_call_output',
            call_id: tool.call_id,
            output: JSON.stringify({ error: e.message }),
          },
        });
      }
      this.createResponse();
    };

    // Handlers to update internal conversation state
    this.realtime.on('server.response.created', handler);
    this.realtime.on('server.response.output_item.added', handler);
    this.realtime.on('server.response.content_part.added', handler);
    this.realtime.on('server.input_audio_buffer.speech_started', (event) => {
      console.log('[DEBUG CLIENT] speech_started', event.item_id, 'inputAudioBuffer length:', this.inputAudioBuffer.length);
      handler(event);
      this.dispatch('conversation.interrupted');
    });
    this.realtime.on('server.input_audio_buffer.speech_stopped', (event) => {
      console.log('[DEBUG CLIENT] speech_stopped', event.item_id, 'inputAudioBuffer length:', this.inputAudioBuffer.length);
      handler(event, this.inputAudioBuffer);
    });

    // Handlers to update application state
    this.realtime.on('server.conversation.item.created', (event) => {
      const { item } = handlerWithDispatch(event);
      this.dispatch('conversation.item.appended', { item });
      if (item.status === 'completed') {
        this.dispatch('conversation.item.completed', { item });
      }
    });
    // GA event alias: conversation.item.added replaces conversation.item.created in GA API
    this.realtime.on('server.conversation.item.added', (event) => {
      console.log('[DEBUG CLIENT] conversation.item.added (GA)', {
        id: event.item?.id,
        type: event.item?.type,
        role: event.item?.role,
      });
      const { item } = handlerWithDispatch(event);
      if (item) {
        console.log('[DEBUG CLIENT] after item.added processEvent:', {
          id: item.id,
          status: item.status,
          role: item.role,
          audioLength: item.formatted?.audio?.length,
          transcript: item.formatted?.transcript,
        });
        this.dispatch('conversation.item.appended', { item });
        if (item.status === 'completed') {
          this.dispatch('conversation.item.completed', { item });
        }
      }
    });
    // GA event: conversation.item.done provides final item state (including user transcript)
    this.realtime.on('server.conversation.item.done', (event) => {
      console.log('[DEBUG CLIENT] conversation.item.done (GA)', {
        id: event.item?.id,
        role: event.item?.role,
        contentLength: event.item?.content?.length,
        hasTranscript: event.item?.content?.[0]?.transcript ? true : false,
      });
      const { item, delta } = handlerWithDispatch(event);
      if (item) {
        console.log('[DEBUG CLIENT] after item.done processEvent:', {
          id: item.id,
          status: item.status,
          role: item.role,
          transcript: item.formatted?.transcript?.substring(0, 50),
          audioLength: item.formatted?.audio?.length,
        });
        if (item.status === 'completed') {
          this.dispatch('conversation.item.completed', { item });
        }
      }
    });
    this.realtime.on('server.conversation.item.truncated', handlerWithDispatch);
    this.realtime.on('server.conversation.item.deleted', handlerWithDispatch);
    this.realtime.on(
      'server.conversation.item.input_audio_transcription.completed',
      handlerWithDispatch,
    );
    this.realtime.on(
      'server.response.output_audio_transcript.delta',
      handlerWithDispatch,
    );
    this.realtime.on('server.response.output_audio.delta', handlerWithDispatch);
    this.realtime.on('server.response.output_text.delta', handlerWithDispatch);
    // Also listen for legacy event names for backwards compatibility
    this.realtime.on(
      'server.response.audio_transcript.delta',
      handlerWithDispatch,
    );
    this.realtime.on('server.response.audio.delta', handlerWithDispatch);
    this.realtime.on('server.response.text.delta', handlerWithDispatch);
    this.realtime.on(
      'server.response.function_call_arguments.delta',
      handlerWithDispatch,
    );
    this.realtime.on('server.response.output_item.done', async (event) => {
      const { item } = handlerWithDispatch(event);
      if (item.status === 'completed') {
        this.dispatch('conversation.item.completed', { item });
      }
      if (item.formatted.tool) {
        callTool(item.formatted.tool);
      }
    });

    return true;
  }

  /**
   * Tells us whether the realtime socket is connected and the session has started
   * @returns {boolean}
   */
  isConnected() {
    return this.realtime.isConnected();
  }

  /**
   * Resets the client instance entirely: disconnects and clears active config
   * @returns {true}
   */
  reset() {
    this.disconnect();
    this.clearEventHandlers();
    this.realtime.clearEventHandlers();
    this._resetConfig();
    this._addAPIEventHandlers();
    return true;
  }

  /**
   * Connects to the Realtime WebSocket API
   * Updates session config and conversation config
   * @returns {Promise<true>}
   */
  async connect({ model } = {}) {
    if (this.isConnected()) {
      throw new Error(`Already connected, use .disconnect() first`);
    }
    await this.realtime.connect({ model });
    this.updateSession();
    return true;
  }

  /**
   * Waits for a session.created event to be executed before proceeding
   * @returns {Promise<true>}
   */
  async waitForSessionCreated() {
    if (!this.isConnected()) {
      throw new Error(`Not connected, use .connect() first`);
    }
    while (!this.sessionCreated) {
      await new Promise((r) => setTimeout(() => r(), 1));
    }
    return true;
  }

  /**
   * Disconnects from the Realtime API and clears the conversation history
   */
  disconnect() {
    this.sessionCreated = false;
    this.realtime.isConnected() && this.realtime.disconnect();
    this.conversation.clear();
  }

  /**
   * Gets the active turn detection mode
   * @returns {"server_vad"|null}
   */
  getTurnDetectionType() {
    // GA API: turn_detection is under audio.input.turn_detection
    return this.sessionConfig.audio?.input?.turn_detection?.type || this.sessionConfig.turn_detection?.type || null;
  }

  /**
   * Add a tool and handler
   * @param {ToolDefinitionType} definition
   * @param {function} handler
   * @returns {{definition: ToolDefinitionType, handler: function}}
   */
  addTool(definition, handler) {
    if (!definition?.name) {
      throw new Error(`Missing tool name in definition`);
    }
    const name = definition?.name;
    if (this.tools[name]) {
      throw new Error(
        `Tool "${name}" already added. Please use .removeTool("${name}") before trying to add again.`,
      );
    }
    if (typeof handler !== 'function') {
      throw new Error(`Tool "${name}" handler must be a function`);
    }
    this.tools[name] = { definition, handler };
    this.updateSession();
    return this.tools[name];
  }

  /**
   * Removes a tool
   * @param {string} name
   * @returns {true}
   */
  removeTool(name) {
    if (!this.tools[name]) {
      throw new Error(`Tool "${name}" does not exist, can not be removed.`);
    }
    delete this.tools[name];
    return true;
  }

  /**
   * Deletes an item
   * @param {string} id
   * @returns {true}
   */
  deleteItem(id) {
    this.realtime.send('conversation.item.delete', { item_id: id });
    return true;
  }

  /**
   * Updates session configuration
   * If the client is not yet connected, will save details and instantiate upon connection
   * @param {SessionResourceType} [sessionConfig]
   */
  updateSession({
    modalities = void 0,
    instructions = void 0,
    voice = void 0,
    input_audio_format = void 0,
    output_audio_format = void 0,
    input_audio_transcription = void 0,
    turn_detection = void 0,
    tools = void 0,
    tool_choice = void 0,
    temperature = void 0,
    max_response_output_tokens = void 0,
  } = {}) {
    instructions !== void 0 && (this.sessionConfig.instructions = instructions);
    // GA API: voice goes under audio.output.voice
    if (voice !== void 0) {
      if (!this.sessionConfig.audio) this.sessionConfig.audio = {};
      if (!this.sessionConfig.audio.output) this.sessionConfig.audio.output = {};
      this.sessionConfig.audio.output.voice = voice;
    }
    // GA API: input audio format goes under audio.input.format
    if (input_audio_format !== void 0) {
      if (!this.sessionConfig.audio) this.sessionConfig.audio = {};
      if (!this.sessionConfig.audio.input) this.sessionConfig.audio.input = {};
      this.sessionConfig.audio.input.format = input_audio_format;
    }
    // GA API: output audio format goes under audio.output.format
    if (output_audio_format !== void 0) {
      if (!this.sessionConfig.audio) this.sessionConfig.audio = {};
      if (!this.sessionConfig.audio.output) this.sessionConfig.audio.output = {};
      this.sessionConfig.audio.output.format = output_audio_format;
    }
    // GA API: input audio transcription goes under audio.input.transcription
    if (input_audio_transcription !== void 0) {
      if (!this.sessionConfig.audio) this.sessionConfig.audio = {};
      if (!this.sessionConfig.audio.input) this.sessionConfig.audio.input = {};
      this.sessionConfig.audio.input.transcription = input_audio_transcription;
    }
    // GA API: turn_detection goes under audio.input.turn_detection
    if (turn_detection !== void 0) {
      if (!this.sessionConfig.audio) this.sessionConfig.audio = {};
      if (!this.sessionConfig.audio.input) this.sessionConfig.audio.input = {};
      this.sessionConfig.audio.input.turn_detection = turn_detection;
    }
    tools !== void 0 && (this.sessionConfig.tools = tools);
    // NOTE: tool_choice, temperature, max_response_output_tokens are NOT supported in GA API
    // Load tools from tool definitions + already loaded tools
    const useTools = [].concat(
      (tools || []).map((toolDefinition) => {
        const definition = {
          type: 'function',
          ...toolDefinition,
        };
        if (this.tools[definition?.name]) {
          throw new Error(
            `Tool "${definition?.name}" has already been defined`,
          );
        }
        return definition;
      }),
      Object.keys(this.tools).map((key) => {
        return {
          type: 'function',
          ...this.tools[key].definition,
        };
      }),
    );
    const session = { ...this.sessionConfig };
    session.tools = useTools;
    // Ensure session.type is set for GA API
    if (!session.type) {
      session.type = 'realtime';
    }
    // GA API: transcription is under audio.input.transcription, no need for top-level input_audio_transcription
    // Remove ALL legacy/unsupported top-level fields for GA API
    delete session.input_audio_format;
    delete session.output_audio_format;
    delete session.modalities;
    delete session.voice;                       // moved to audio.output.voice
    delete session.turn_detection;              // moved to audio.input.turn_detection
    delete session.temperature;                 // not supported in GA
    delete session.tool_choice;                 // not supported in GA
    delete session.max_response_output_tokens;  // not supported in GA
    delete session.input_audio_transcription;   // moved to audio.input.transcription
    // TODO this is a patch to fix 
    if (session?.audio?.input) {
      session.audio.input.noise_reduction = {
        type: 'near_field',
      };
    }
    session.reasoning = {
      effort: 'low',
    };
    console.log('[DEBUG CLIENT] session.update payload:', JSON.stringify(session, null, 2));
    if (this.realtime.isConnected()) {
      this.realtime.send('session.update', { session });
    }
    return true;
  }

  /**
   * Sends user message content and generates a response
   * @param {Array<InputTextContentType|InputAudioContentType>} content
   * @returns {true}
   */
  sendUserMessageContent(content = []) {
    if (content.length) {
      for (const c of content) {
        if (c.type === 'input_audio') {
          if (c.audio instanceof ArrayBuffer || c.audio instanceof Int16Array) {
            c.audio = RealtimeUtils.arrayBufferToBase64(c.audio);
          }
        }
      }
      this.realtime.send('conversation.item.create', {
        item: {
          type: 'message',
          role: 'user',
          content,
        },
      });
    }
    this.createResponse();
    return true;
  }

  /**
   * Appends user audio to the existing audio buffer
   * @param {Int16Array|ArrayBuffer} arrayBuffer
   * @returns {true}
   */
  appendInputAudio(arrayBuffer) {
    if (arrayBuffer.byteLength > 0) {
      this.realtime.send('input_audio_buffer.append', {
        audio: RealtimeUtils.arrayBufferToBase64(arrayBuffer),
      });
      this.inputAudioBuffer = RealtimeUtils.mergeInt16Arrays(
        this.inputAudioBuffer,
        arrayBuffer,
      );
    }
    return true;
  }

  /**
   * Forces a model response generation
   * @returns {true}
   */
  createResponse() {
    if (
      this.getTurnDetectionType() === null &&
      this.inputAudioBuffer.byteLength > 0
    ) {
      this.realtime.send('input_audio_buffer.commit');
      this.conversation.queueInputAudio(this.inputAudioBuffer);
      this.inputAudioBuffer = new Int16Array(0);
    }
    this.realtime.send('response.create');
    return true;
  }

  /**
   * Cancels the ongoing server generation and truncates ongoing generation, if applicable
   * If no id provided, will simply call `cancel_generation` command
   * @param {string} id The id of the message to cancel
   * @param {number} [sampleCount] The number of samples to truncate past for the ongoing generation
   * @returns {{item: (AssistantItemType | null)}}
   */
  cancelResponse(id, sampleCount = 0) {
    if (!id) {
      this.realtime.send('response.cancel');
      return { item: null };
    } else if (id) {
      const item = this.conversation.getItem(id);
      if (!item) {
        throw new Error(`Could not find item "${id}"`);
      }
      if (item.type !== 'message') {
        // GA API items may not have type 'message', just cancel without truncating
        this.realtime.send('response.cancel');
        return { item: null };
      } else if (item.role !== 'assistant') {
        this.realtime.send('response.cancel');
        return { item: null };
      }
      this.realtime.send('response.cancel');
      const audioIndex = item.content.findIndex((c) => c.type === 'audio');
      if (audioIndex === -1) {
        // No audio content to truncate, just cancel
        return { item };
      }
      this.realtime.send('conversation.item.truncate', {
        item_id: id,
        content_index: audioIndex,
        audio_end_ms: Math.floor(
          (sampleCount / this.conversation.defaultFrequency) * 1000,
        ),
      });
      return { item };
    }
  }

  /**
   * Utility for waiting for the next `conversation.item.appended` event to be triggered by the server
   * @returns {Promise<{item: ItemType}>}
   */
  async waitForNextItem() {
    const event = await this.waitForNext('conversation.item.appended');
    const { item } = event;
    return { item };
  }

  /**
   * Utility for waiting for the next `conversation.item.completed` event to be triggered by the server
   * @returns {Promise<{item: ItemType}>}
   */
  async waitForNextCompletedItem() {
    const event = await this.waitForNext('conversation.item.completed');
    const { item } = event;
    return { item };
  }
}
