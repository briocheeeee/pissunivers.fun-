import {
  DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID,
} from '../core/config.js';
import {
  getUserByDiscordId,
  linkDiscordAccount,
  addDiscordTemplate,
  deleteDiscordTemplate,
  getDiscordTemplate,
  getUserDiscordTemplates,
} from '../data/sql/DiscordTemplate.js';
import RedisCanvas from '../data/redis/RedisCanvas.js';
import { TILE_SIZE } from '../core/constants.js';

let discordJs = null;
let canvasModule = null;
let client = null;
let canvasesData = null;

async function loadDependencies() {
  if (!discordJs) {
    try {
      discordJs = await import(/* webpackIgnore: true */ 'discord.js');
    } catch (e) {
      console.error('discord.js not installed, Discord bot disabled');
      return null;
    }
  }
  if (!canvasModule) {
    try {
      canvasModule = await import(/* webpackIgnore: true */ 'canvas');
    } catch (e) {
      console.error('canvas not installed, Discord bot disabled');
      return null;
    }
  }
  return { discordJs, canvasModule };
}

const CANVAS_NAMES = {
  'world map': 0,
  worldmap: 0,
  d: 0,
  minimap: 1,
  moon: 1,
  c: 1,
};

function parseCanvasName(input) {
  const lower = input.toLowerCase().trim();
  if (CANVAS_NAMES[lower] !== undefined) {
    return CANVAS_NAMES[lower];
  }
  const num = parseInt(input, 10);
  if (!Number.isNaN(num)) {
    return num;
  }
  return null;
}

function parseCoordinates(input) {
  const match = input.match(/^(-?\d+)[_,\s]+(-?\d+)$/);
  if (match) {
    return { x: parseInt(match[1], 10), y: parseInt(match[2], 10) };
  }
  return null;
}

async function scanTemplate(template, canvases) {
  const deps = await loadDependencies();
  if (!deps) return { error: 'Dependencies not available' };
  const { canvasModule } = deps;
  const { createCanvas, loadImage } = canvasModule;

  const canvas = canvases[template.canvasId];
  if (!canvas) {
    return { error: 'Invalid canvas' };
  }

  const { colors, size: canvasSize } = canvas;
  const templateImage = await loadImage(template.imageData);
  const templateWidth = template.width;
  const templateHeight = template.height;

  const tempCanvas = createCanvas(templateWidth, templateHeight);
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(templateImage, 0, 0);
  const templatePixels = tempCtx.getImageData(0, 0, templateWidth, templateHeight).data;

  const resultCanvas = createCanvas(templateWidth, templateHeight);
  const resultCtx = resultCanvas.getContext('2d');

  const startX = template.x;
  const startY = template.y;

  const startChunkX = Math.floor(startX / TILE_SIZE);
  const startChunkY = Math.floor(startY / TILE_SIZE);
  const endChunkX = Math.floor((startX + templateWidth - 1) / TILE_SIZE);
  const endChunkY = Math.floor((startY + templateHeight - 1) / TILE_SIZE);

  const chunks = new Map();

  for (let cy = startChunkY; cy <= endChunkY; cy += 1) {
    for (let cx = startChunkX; cx <= endChunkX; cx += 1) {
      const chunkKey = `${cx}:${cy}`;
      const chunk = await RedisCanvas.getChunk(template.canvasId, cx, cy);
      chunks.set(chunkKey, chunk);
    }
  }

  let placedPixels = 0;
  let totalPixels = 0;

  for (let py = 0; py < templateHeight; py += 1) {
    for (let px = 0; px < templateWidth; px += 1) {
      const templateIdx = (py * templateWidth + px) * 4;
      const alpha = templatePixels[templateIdx + 3];

      if (alpha <= 200) {
        resultCtx.fillStyle = 'rgba(0,0,0,0)';
        resultCtx.fillRect(px, py, 1, 1);
        continue;
      }

      totalPixels += 1;

      const templateR = templatePixels[templateIdx];
      const templateG = templatePixels[templateIdx + 1];
      const templateB = templatePixels[templateIdx + 2];

      const canvasX = startX + px;
      const canvasY = startY + py;

      if (canvasX < 0 || canvasX >= canvasSize || canvasY < 0 || canvasY >= canvasSize) {
        resultCtx.fillStyle = `rgba(${Math.min(255, templateR + 100)}, ${Math.max(0, templateG - 50)}, ${Math.max(0, templateB - 50)}, 1)`;
        resultCtx.fillRect(px, py, 1, 1);
        continue;
      }

      const chunkX = Math.floor(canvasX / TILE_SIZE);
      const chunkY = Math.floor(canvasY / TILE_SIZE);
      const chunkKey = `${chunkX}:${chunkY}`;
      const chunk = chunks.get(chunkKey);

      if (!chunk) {
        resultCtx.fillStyle = `rgba(${Math.min(255, templateR + 100)}, ${Math.max(0, templateG - 50)}, ${Math.max(0, templateB - 50)}, 1)`;
        resultCtx.fillRect(px, py, 1, 1);
        continue;
      }

      const offsetX = canvasX % TILE_SIZE;
      const offsetY = canvasY % TILE_SIZE;
      const chunkIdx = offsetY * TILE_SIZE + offsetX;

      const colorIndex = chunk[chunkIdx];
      if (colorIndex === undefined || colorIndex >= colors.length) {
        resultCtx.fillStyle = `rgba(${Math.min(255, templateR + 100)}, ${Math.max(0, templateG - 50)}, ${Math.max(0, templateB - 50)}, 1)`;
        resultCtx.fillRect(px, py, 1, 1);
        continue;
      }

      const canvasColor = colors[colorIndex];
      if (!canvasColor) {
        resultCtx.fillStyle = `rgba(${Math.min(255, templateR + 100)}, ${Math.max(0, templateG - 50)}, ${Math.max(0, templateB - 50)}, 1)`;
        resultCtx.fillRect(px, py, 1, 1);
        continue;
      }

      const [canvasR, canvasG, canvasB] = canvasColor;
      const distance = Math.sqrt(
        (templateR - canvasR) ** 2 + (templateG - canvasG) ** 2 + (templateB - canvasB) ** 2,
      );

      if (distance < 30) {
        placedPixels += 1;
        const gray = Math.round(0.299 * templateR + 0.587 * templateG + 0.114 * templateB);
        resultCtx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
        resultCtx.fillRect(px, py, 1, 1);
      } else {
        const redOverlay = Math.min(255, templateR + 80);
        const greenReduced = Math.max(0, templateG - 40);
        const blueReduced = Math.max(0, templateB - 40);
        resultCtx.fillStyle = `rgb(${redOverlay}, ${greenReduced}, ${blueReduced})`;
        resultCtx.fillRect(px, py, 1, 1);
      }
    }
  }

  const progressPercent = totalPixels > 0 ? Math.round((placedPixels / totalPixels) * 100) : 0;

  return {
    success: true,
    imageBuffer: resultCanvas.toBuffer('image/png'),
    placedPixels,
    totalPixels,
    remainingPixels: totalPixels - placedPixels,
    progressPercent,
  };
}

async function registerCommands() {
  const deps = await loadDependencies();
  if (!deps) return;
  const { discordJs } = deps;
  const { SlashCommandBuilder, REST, Routes } = discordJs;

  const commands = [
    new SlashCommandBuilder()
      .setName('connect-account')
      .setDescription('Link your Discord account to your Pixuniverse account')
      .addStringOption((option) => option
        .setName('username')
        .setDescription('Your Pixuniverse username')
        .setRequired(true))
      .addStringOption((option) => option
        .setName('password')
        .setDescription('Your Pixuniverse password')
        .setRequired(true)),

    new SlashCommandBuilder()
      .setName('template-add')
      .setDescription('Add a new template')
      .addStringOption((option) => option
        .setName('name')
        .setDescription('Template name')
        .setRequired(true))
      .addStringOption((option) => option
        .setName('coordinates')
        .setDescription('Top-left coordinates (x_y format)')
        .setRequired(true))
      .addAttachmentOption((option) => option
        .setName('image')
        .setDescription('Template image')
        .setRequired(true))
      .addStringOption((option) => option
        .setName('canvas')
        .setDescription('Canvas name (world map, minimap, moon)')
        .setRequired(true)),

    new SlashCommandBuilder()
      .setName('template-delete')
      .setDescription('Delete one of your templates')
      .addStringOption((option) => option
        .setName('name')
        .setDescription('Template name to delete')
        .setRequired(true)),

    new SlashCommandBuilder()
      .setName('template-scan')
      .setDescription('Scan a template to check progress')
      .addStringOption((option) => option
        .setName('name')
        .setDescription('Template name to scan')
        .setRequired(true)),

    new SlashCommandBuilder()
      .setName('template-list')
      .setDescription('List all your templates'),
  ];

  const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);

  try {
    console.log('Registering Discord slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, DISCORD_GUILD_ID),
      { body: commands.map((c) => c.toJSON()) },
    );
    console.log('Discord slash commands registered successfully');
  } catch (error) {
    console.error('Error registering Discord commands:', error);
  }
}

async function handleConnectAccount(interaction) {
  const username = interaction.options.getString('username');
  const password = interaction.options.getString('password');
  const discordUserId = interaction.user.id;

  await interaction.deferReply({ ephemeral: true });

  try {
    const response = await fetch(`http://localhost:${process.env.PORT || 8080}/api/auth/local`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nameoremail: username, password }),
    });

    const data = await response.json();

    if (!response.ok || data.errors) {
      await interaction.editReply({ content: `❌ Authentication failed: ${data.errors?.[0] || 'Invalid credentials'}` });
      return;
    }

    const success = await linkDiscordAccount(data.me.id, discordUserId);

    if (success) {
      await interaction.editReply({ content: `✅ Successfully linked your Discord account to **${data.me.name}**!` });
    } else {
      await interaction.editReply({ content: '❌ Failed to link account. Please try again.' });
    }
  } catch (error) {
    console.error('Error in connect-account:', error);
    await interaction.editReply({ content: '❌ An error occurred. Please try again later.' });
  }
}

async function handleTemplateAdd(interaction) {
  const discordUserId = interaction.user.id;

  const user = await getUserByDiscordId(discordUserId);
  if (!user) {
    await interaction.reply({ content: '❌ You must link your account first using `/connect-account`', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const name = interaction.options.getString('name');
  const coordinatesStr = interaction.options.getString('coordinates');
  const attachment = interaction.options.getAttachment('image');
  const canvasStr = interaction.options.getString('canvas');

  const coords = parseCoordinates(coordinatesStr);
  if (!coords) {
    await interaction.editReply({ content: '❌ Invalid coordinates format. Use x_y (e.g., 100_200)' });
    return;
  }

  const canvasId = parseCanvasName(canvasStr);
  if (canvasId === null) {
    await interaction.editReply({ content: '❌ Invalid canvas. Use: world map, minimap, or moon' });
    return;
  }

  if (!attachment.contentType?.startsWith('image/')) {
    await interaction.editReply({ content: '❌ Please provide a valid image file' });
    return;
  }

  try {
    const imageResponse = await fetch(attachment.url);
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    const deps = await loadDependencies();
    if (!deps) {
      await interaction.editReply({ content: '❌ Image processing not available' });
      return;
    }
    const { canvasModule } = deps;
    const { loadImage } = canvasModule;

    const image = await loadImage(imageBuffer);
    const { width } = image;
    const { height } = image;

    if (width > 2048 || height > 2048) {
      await interaction.editReply({ content: '❌ Image too large. Maximum size is 2048x2048 pixels.' });
      return;
    }

    const result = await addDiscordTemplate(
      user.id,
      discordUserId,
      name,
      canvasId,
      coords.x,
      coords.y,
      width,
      height,
      imageBuffer,
      attachment.contentType,
    );

    if (result.error) {
      await interaction.editReply({ content: `❌ ${result.error}` });
      return;
    }

    await interaction.editReply({
      content: `✅ Template **${name}** added successfully!\n📍 Position: (${coords.x}, ${coords.y})\n📐 Size: ${width}x${height}\n🗺️ Canvas: ${canvasStr}`,
    });
  } catch (error) {
    console.error('Error in template-add:', error);
    await interaction.editReply({ content: '❌ Failed to add template. Please try again.' });
  }
}

async function handleTemplateDelete(interaction) {
  const discordUserId = interaction.user.id;

  const user = await getUserByDiscordId(discordUserId);
  if (!user) {
    await interaction.reply({ content: '❌ You must link your account first using `/connect-account`', ephemeral: true });
    return;
  }

  const name = interaction.options.getString('name');

  const result = await deleteDiscordTemplate(user.id, name);

  if (result.error) {
    await interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
    return;
  }

  await interaction.reply({ content: `✅ Template **${name}** deleted successfully!` });
}

async function handleTemplateScan(interaction) {
  const discordUserId = interaction.user.id;

  const user = await getUserByDiscordId(discordUserId);
  if (!user) {
    await interaction.reply({ content: '❌ You must link your account first using `/connect-account`', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const name = interaction.options.getString('name');

  const template = await getDiscordTemplate(user.id, name);
  if (!template) {
    await interaction.editReply({ content: `❌ Template **${name}** not found` });
    return;
  }

  try {
    const result = await scanTemplate(template, canvasesData);

    if (result.error) {
      await interaction.editReply({ content: `❌ ${result.error}` });
      return;
    }

    const deps = await loadDependencies();
    if (!deps) {
      await interaction.editReply({ content: '❌ Dependencies not available' });
      return;
    }
    const { discordJs } = deps;
    const { AttachmentBuilder } = discordJs;

    const attachment = new AttachmentBuilder(result.imageBuffer, { name: `${name}_scan.png` });

    const progressBar = '█'.repeat(Math.floor(result.progressPercent / 10)) + '░'.repeat(10 - Math.floor(result.progressPercent / 10));

    await interaction.editReply({
      content: `📊 **Template Scan: ${name}**\n\n`
        + `Progress: [${progressBar}] **${result.progressPercent}%**\n`
        + `✅ Placed: **${result.placedPixels.toLocaleString()}** pixels\n`
        + `❌ Remaining: **${result.remainingPixels.toLocaleString()}** pixels\n`
        + `📦 Total: **${result.totalPixels.toLocaleString()}** pixels\n\n`
        + '🔴 Red = Not placed | ⚫ Gray = Placed',
      files: [attachment],
    });
  } catch (error) {
    console.error('Error in template-scan:', error);
    await interaction.editReply({ content: '❌ Failed to scan template. Please try again.' });
  }
}

async function handleTemplateList(interaction) {
  const discordUserId = interaction.user.id;

  const user = await getUserByDiscordId(discordUserId);
  if (!user) {
    await interaction.reply({ content: '❌ You must link your account first using `/connect-account`', ephemeral: true });
    return;
  }

  const templates = await getUserDiscordTemplates(user.id);

  if (templates.length === 0) {
    await interaction.reply({ content: '📋 You have no templates. Use `/template-add` to create one!', ephemeral: true });
    return;
  }

  const canvasNames = { 0: 'World Map', 1: 'Moon' };

  const list = templates.map((t, i) => {
    const canvasName = canvasNames[t.canvasId] || `Canvas ${t.canvasId}`;
    return `**${i + 1}. ${t.name}**\n   📍 (${t.x}, ${t.y}) | 📐 ${t.width}x${t.height} | 🗺️ ${canvasName}`;
  }).join('\n\n');

  await interaction.reply({
    content: `📋 **Your Templates (${templates.length})**\n\n${list}`,
    ephemeral: true,
  });
}

export async function initDiscordBot(canvases) {
  if (!DISCORD_BOT_TOKEN) {
    console.log('Discord bot token not configured, skipping bot initialization');
    return;
  }

  const deps = await loadDependencies();
  if (!deps) {
    console.log('Discord dependencies not available, skipping bot initialization');
    return;
  }
  const { discordJs } = deps;
  const { Client, GatewayIntentBits } = discordJs;

  canvasesData = canvases;

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
    ],
  });

  client.once('ready', async () => {
    console.log(`Discord bot logged in as ${client.user.tag}`);
    await registerCommands();
  });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
      switch (commandName) {
        case 'connect-account':
          await handleConnectAccount(interaction);
          break;
        case 'template-add':
          await handleTemplateAdd(interaction);
          break;
        case 'template-delete':
          await handleTemplateDelete(interaction);
          break;
        case 'template-scan':
          await handleTemplateScan(interaction);
          break;
        case 'template-list':
          await handleTemplateList(interaction);
          break;
        default:
          break;
      }
    } catch (error) {
      console.error(`Error handling command ${commandName}:`, error);
      const reply = { content: '❌ An error occurred while processing your command.', ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  });

  await client.login(DISCORD_BOT_TOKEN);
}

export function getDiscordClient() {
  return client;
}
