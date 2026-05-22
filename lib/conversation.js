import { RealtimeUtils } from './utils.js';

/**
 * Contains text and audio information about a item
 * Can also be used as a delta
 * @typedef {Object} ItemContentDeltaType
 * @property {string} [text]
 * @property {Int16Array} [audio]
 * @property {string} [arguments]
 * @property {string} [transcript]
 */

/**
 * RealtimeConversation holds conversation history
 * and performs event validation for RealtimeAPI
 * @class
 */
export class RealtimeConversation {
  defaultFrequency = 24_000; // 24,000 Hz

  EventProcessors = {
    'conversation.item.created': (event) => {
      const { item } = event;
      // deep copy values
      const newItem = JSON.parse(JSON.stringify(item));
      const existingItem = this.itemLookup[newItem.id];
      if (existingItem) {
        // Merge incoming item data into the existing stub, preserving accumulated formatted data
        const preservedFormatted = existingItem.formatted;
        Object.assign(existingItem, newItem);
        // Restore the formatted data that was accumulated from delta events
        existingItem.formatted = preservedFormatted || {};
        if (!existingItem.formatted.audio) {
          existingItem.formatted.audio = new Int16Array(0);
        }
        if (!existingItem.formatted.text) {
          existingItem.formatted.text = '';
        }
        if (!existingItem.formatted.transcript) {
          existingItem.formatted.transcript = '';
        }
      } else {
        this.itemLookup[newItem.id] = newItem;
        this.items.push(newItem);
        newItem.formatted = {};
        newItem.formatted.audio = new Int16Array(0);
        newItem.formatted.text = '';
        newItem.formatted.transcript = '';
      }
      const targetItem = this.itemLookup[newItem.id];
      // If we have a speech item, can populate audio
      if (this.queuedSpeechItems[newItem.id]) {
        targetItem.formatted.audio = this.queuedSpeechItems[newItem.id].audio;
        delete this.queuedSpeechItems[newItem.id]; // free up some memory
      }
      // Populate formatted text if it comes out on creation
      if (targetItem.content) {
        const textContent = targetItem.content.filter((c) =>
          ['text', 'input_text'].includes(c.type),
        );
        for (const content of textContent) {
          if (targetItem.formatted.text === '') {
            targetItem.formatted.text += content.text;
          }
        }
      }
      // If we have a transcript item, can pre-populate transcript
      if (this.queuedTranscriptItems[newItem.id]) {
        targetItem.formatted.transcript = this.queuedTranscriptItems[newItem.id].transcript;
        delete this.queuedTranscriptItems[newItem.id];
      }
      if (targetItem.type === 'message') {
        if (targetItem.role === 'user') {
          targetItem.status = 'completed';
          if (this.queuedInputAudio) {
            targetItem.formatted.audio = this.queuedInputAudio;
            this.queuedInputAudio = null;
          }
        } else {
          if (!targetItem.status || targetItem.status === 'in_progress') {
            targetItem.status = 'in_progress';
          }
        }
      } else if (targetItem.type === 'function_call') {
        targetItem.formatted.tool = {
          type: 'function',
          name: targetItem.name,
          call_id: targetItem.call_id,
          arguments: '',
        };
        targetItem.status = 'in_progress';
      } else if (targetItem.type === 'function_call_output') {
        targetItem.status = 'completed';
        targetItem.formatted.output = targetItem.output;
      }
      return { item: targetItem, delta: null };
    },
    // GA event name alias: conversation.item.added is the GA equivalent of conversation.item.created
    'conversation.item.added': function (event) {
      return this.EventProcessors['conversation.item.created'].call(this, event);
    },
    // GA event: conversation.item.done fires when an item is fully complete (includes transcript for user items)
    'conversation.item.done': (event) => {
      const { item } = event;
      if (!item) {
        return { item: null, delta: null };
      }
      let existingItem = this.itemLookup[item.id];
      if (!existingItem) {
        // If item doesn't exist yet, create it through the normal path
        return this.EventProcessors['conversation.item.created'].call(this, event);
      }
      // Always mark as completed when done event fires
      existingItem.status = 'completed';
      // Update role if available
      if (item.role) {
        existingItem.role = item.role;
      }
      // Update type if available
      if (item.type) {
        existingItem.type = item.type;
      }
      // Sync content and extract transcript from the done event's item
      if (item.content && item.content.length > 0) {
        // Replace content array with the final version
        existingItem.content = item.content;
        // Extract transcript from any content part
        for (let i = 0; i < item.content.length; i++) {
          const part = item.content[i];
          if (part.transcript) {
            existingItem.formatted.transcript = part.transcript;
          }
          if (part.text) {
            existingItem.formatted.text = part.text;
          }
        }
      }
      return { item: existingItem, delta: { transcript: existingItem.formatted.transcript } };
    },
    'conversation.item.truncated': (event) => {
      const { item_id, audio_end_ms } = event;
      const item = this.itemLookup[item_id];
      if (!item) {
        console.warn(`item.truncated: Item "${item_id}" not found, skipping`);
        return { item: null, delta: null };
      }
      const endIndex = Math.floor(
        (audio_end_ms * this.defaultFrequency) / 1000,
      );
      item.formatted.transcript = '';
      item.formatted.audio = item.formatted.audio.slice(0, endIndex);
      return { item, delta: null };
    },
    'conversation.item.deleted': (event) => {
      const { item_id } = event;
      const item = this.itemLookup[item_id];
      if (!item) {
        console.warn(`item.deleted: Item "${item_id}" not found, skipping`);
        return { item: null, delta: null };
      }
      delete this.itemLookup[item.id];
      const index = this.items.indexOf(item);
      if (index > -1) {
        this.items.splice(index, 1);
      }
      return { item, delta: null };
    },
    'conversation.item.input_audio_transcription.completed': (event) => {
      const { item_id, content_index, transcript } = event;
      let item = this.itemLookup[item_id];
      // We use a single space to represent an empty transcript for .formatted values
      // Otherwise it looks like no transcript provided
      const formattedTranscript = transcript || ' ';
      if (!item) {
        // We can receive transcripts in VAD mode before item.created
        // This happens specifically when audio is empty
        this.queuedTranscriptItems[item_id] = {
          transcript: formattedTranscript,
        };
        return { item: null, delta: null };
      } else {
        if (item.content && item.content[content_index]) {
          item.content[content_index].transcript = transcript;
        }
        item.formatted.transcript = formattedTranscript;
        return { item, delta: { transcript } };
      }
    },
    'input_audio_buffer.speech_started': (event) => {
      const { item_id, audio_start_ms } = event;
      this.queuedSpeechItems[item_id] = { audio_start_ms };
      return { item: null, delta: null };
    },
    'input_audio_buffer.speech_stopped': (event, inputAudioBuffer) => {
      const { item_id, audio_end_ms } = event;
      if (!this.queuedSpeechItems[item_id]) {
        this.queuedSpeechItems[item_id] = { audio_start_ms: audio_end_ms };
      }
      const speech = this.queuedSpeechItems[item_id];
      speech.audio_end_ms = audio_end_ms;
      if (inputAudioBuffer) {
        const startIndex = Math.floor(
          (speech.audio_start_ms * this.defaultFrequency) / 1000,
        );
        const endIndex = Math.floor(
          (speech.audio_end_ms * this.defaultFrequency) / 1000,
        );
        speech.audio = inputAudioBuffer.slice(startIndex, endIndex);
      }
      return { item: null, delta: null };
    },
    'response.created': (event) => {
      const { response } = event;
      if (!this.responseLookup[response.id]) {
        this.responseLookup[response.id] = response;
        this.responses.push(response);
      }
      return { item: null, delta: null };
    },
    'response.output_item.added': (event) => {
      const { response_id, item } = event;
      let response = this.responseLookup[response_id];
      if (!response) {
        // GA API may send output_item.added before response.created
        response = { id: response_id, output: [] };
        this.responseLookup[response_id] = response;
        this.responses.push(response);
      }
      response.output.push(item.id);
      return { item: null, delta: null };
    },
    'response.output_item.done': (event) => {
      const { item } = event;
      if (!item) {
        throw new Error(`response.output_item.done: Missing "item"`);
      }
      let foundItem = this.itemLookup[item.id];
      if (!foundItem) {
        // GA API may send done before conversation.item.created
        foundItem = this._ensureItem(item.id);
      }
      foundItem.status = item.status;
      return { item: foundItem, delta: null };
    },
    'response.content_part.added': (event) => {
      const { item_id, part } = event;
      let item = this.itemLookup[item_id];
      if (!item) {
        // GA API may send content_part before conversation.item.created
        item = this._ensureItem(item_id);
      }
      item.content.push(part);
      return { item, delta: null };
    },
    'response.audio_transcript.delta': (event) => {
      const { item_id, content_index, delta } = event;
      let item = this.itemLookup[item_id];
      if (!item) {
        // GA API may send deltas before conversation.item.created
        item = this._ensureItem(item_id);
      }
      if (item.content && item.content[content_index]) {
        item.content[content_index].transcript += delta;
      }
      item.formatted.transcript += delta;
      return { item, delta: { transcript: delta } };
    },
    // GA event name alias
    'response.output_audio_transcript.delta': function (event) {
      return this.EventProcessors['response.audio_transcript.delta'].call(this, event);
    },
    'response.audio.delta': (event) => {
      const { item_id, content_index, delta } = event;
      let item = this.itemLookup[item_id];
      if (!item) {
        // GA API may send deltas before conversation.item.created
        item = this._ensureItem(item_id);
      }
      const arrayBuffer = RealtimeUtils.base64ToArrayBuffer(delta);
      const appendValues = new Int16Array(arrayBuffer);
      item.formatted.audio = RealtimeUtils.mergeInt16Arrays(
        item.formatted.audio,
        appendValues,
      );
      return { item, delta: { audio: appendValues } };
    },
    // GA event name alias
    'response.output_audio.delta': function (event) {
      return this.EventProcessors['response.audio.delta'].call(this, event);
    },
    'response.text.delta': (event) => {
      const { item_id, content_index, delta } = event;
      let item = this.itemLookup[item_id];
      if (!item) {
        // GA API may send deltas before conversation.item.created
        item = this._ensureItem(item_id);
      }
      if (item.content && item.content[content_index]) {
        item.content[content_index].text += delta;
      }
      item.formatted.text += delta;
      return { item, delta: { text: delta } };
    },
    // GA event name alias
    'response.output_text.delta': function (event) {
      return this.EventProcessors['response.text.delta'].call(this, event);
    },
    'response.function_call_arguments.delta': (event) => {
      const { item_id, delta } = event;
      let item = this.itemLookup[item_id];
      if (!item) {
        item = this._ensureItem(item_id);
      }
      item.arguments += delta;
      if (item.formatted.tool) {
        item.formatted.tool.arguments += delta;
      }
      return { item, delta: { arguments: delta } };
    },
  };

  /**
   * Create a new RealtimeConversation instance
   * @returns {RealtimeConversation}
   */
  constructor() {
    this.clear();
  }

  /**
   * Clears the conversation history and resets to default
   * @returns {true}
   */
  clear() {
    this.itemLookup = {};
    this.items = [];
    this.responseLookup = {};
    this.responses = [];
    this.queuedSpeechItems = {};
    this.queuedTranscriptItems = {};
    this.queuedInputAudio = null;
    return true;
  }

  /**
   * Creates a stub item entry when GA API sends events before conversation.item.created
   * @param {string} id
   * @returns {Object} The stub item
   * @private
   */
  _ensureItem(id) {
    if (this.itemLookup[id]) {
      return this.itemLookup[id];
    }
    const stub = {
      id,
      object: 'realtime.item',
      status: 'in_progress',
      role: 'assistant',
      content: [],
      arguments: '',
      formatted: {
        audio: new Int16Array(0),
        text: '',
        transcript: '',
      },
    };
    this.itemLookup[id] = stub;
    this.items.push(stub);
    return stub;
  }

  /**
   * Queue input audio for manual speech event
   * @param {Int16Array} inputAudio
   * @returns {Int16Array}
   */
  queueInputAudio(inputAudio) {
    this.queuedInputAudio = inputAudio;
    return inputAudio;
  }

  /**
   * Process an event from the WebSocket server and compose items
   * @param {Object} event
   * @param  {...any} args
   * @returns {item: import('./client.js').ItemType | null, delta: ItemContentDeltaType | null}
   */
  processEvent(event, ...args) {
    if (!event.event_id) {
      console.error(event);
      throw new Error(`Missing "event_id" on event`);
    }
    if (!event.type) {
      console.error(event);
      throw new Error(`Missing "type" on event`);
    }
    const eventProcessor = this.EventProcessors[event.type];
    if (!eventProcessor) {
      throw new Error(
        `Missing conversation event processor for "${event.type}"`,
      );
    }
    return eventProcessor.call(this, event, ...args);
  }

  /**
   * Retrieves a item by id
   * @param {string} id
   * @returns {import('./client.js').ItemType}
   */
  getItem(id) {
    return this.itemLookup[id] || null;
  }

  /**
   * Retrieves all items in the conversation
   * @returns {import('./client.js').ItemType[]}
   */
  getItems() {
    return this.items.slice();
  }
}
