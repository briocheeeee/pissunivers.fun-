/*
 * Buffer for chatMessages for the server
 * it just buffers the most recent 200 messages for each channel
 *
 */
import { storeMessage, getMessagesForChannel } from '../data/sql/Message.js';

const MAX_BUFFER_TIME = 600000;

class ChatMessageBuffer {
  constructor(socketEvents) {
    this.buffer = new Map();
    this.timestamps = new Map();

    this.cleanBuffer = this.cleanBuffer.bind(this);
    this.cleanLoop = setInterval(this.cleanBuffer, 3 * 60 * 1000);
    this.socketEvents = socketEvents;
    socketEvents.on('chatMessage', (
      name,
      message,
      channelId,
      uid,
      country,
      sendapi,
      faction,
      avatar,
      badges,
    ) => {
      this.addMessage(name, message, channelId, uid, country, faction, avatar, badges);
    });
  }

  async getMessages(cid, limit = 30) {
    if (limit > 200) {
      return getMessagesForChannel(cid, limit);
    }

    let messages = this.buffer.get(cid);
    if (!messages) {
      messages = await getMessagesForChannel(cid, limit);
      this.buffer.set(cid, messages);
    }
    this.timestamps.set(cid, Date.now());
    return messages.slice(-limit);
  }

  cleanBuffer() {
    const curTime = Date.now();
    const toDelete = [];
    this.timestamps.forEach((timestamp, cid) => {
      if (curTime > timestamp + MAX_BUFFER_TIME) {
        toDelete.push(cid);
      }
    });
    toDelete.forEach((cid) => {
      this.timestamps.delete(cid);
      this.buffer.delete(cid);
    });
  }

  async broadcastChatMessage(
    name,
    message,
    cid,
    uid,
    flag = 'xx',
    sendapi = true,
    faction = null,
    avatar = null,
    badges = [],
  ) {
    if (message.length > 200) {
      return;
    }
    storeMessage(flag, message, cid, uid);
    /*
     * goes through socket events and then comes
     * back at addMessage
     */
    this.socketEvents.broadcastChatMessage(
      name,
      message,
      cid,
      uid,
      flag,
      sendapi,
      faction,
      avatar,
      badges,
    );
  }

  async addMessage(
    name,
    message,
    cid,
    uid,
    flag,
    faction,
    avatar,
    badges,
  ) {
    const messages = this.buffer.get(cid);
    if (messages) {
      messages.push([
        name,
        message,
        flag,
        uid,
        Math.round(Date.now() / 1000),
        faction,
        avatar,
        badges,
      ]);
    }
  }
}

export default ChatMessageBuffer;
