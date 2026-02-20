import {
  DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID,
  PORT,
  BACKUP_URL,
} from '../core/config.js';
import { startStatusCheck } from './statusCheck.js';
import { startVoidPing } from './voidPing.js';
import { generateTimelapse } from './timelapse.js';
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
import logger from '../core/logger.js';

let Client = null;
let Intents = null;
let MessageAttachment = null;
let REST = null;
let Routes = null;
let SlashCommandBuilder = null;
let client = null;
let canvasesData = null;
let sharpModule = null;
let dependenciesLoaded = false;

async function loadDependencies() {
  if (dependenciesLoaded) return true;
  
  try {
    const discordJs = await import(/* webpackIgnore: true */ 'discord.js');
    Client = discordJs.Client;
    Intents = discordJs.Intents;
    MessageAttachment = discordJs.MessageAttachment;
    
    const discordRest = await import(/* webpackIgnore: true */ '@discordjs/rest');
    REST = discordRest.REST;
    
    const discordApiTypes = await import(/* webpackIgnore: true */ 'discord-api-types/v9');
    Routes = discordApiTypes.Routes;
    
    const builders = await import(/* webpackIgnore: true */ '@discordjs/builders');
    SlashCommandBuilder = builders.SlashCommandBuilder;
    
    dependenciesLoaded = true;
  } catch (e) {
    logger.error(`Discord.js dependencies not available: ${e.message}`);
    return false;
  }
  
  try {
    sharpModule = (await import(/* webpackIgnore: true */ 'sharp')).default;
  } catch (e) {
    logger.warn(`Sharp module not available: ${e.message}`);
  }
  
  return true;
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
  if (!sharpModule) {
    return { error: 'Image processing not available' };
  }

  const canvas = canvases[template.canvasId];
  if (!canvas) {
    return { error: 'Invalid canvas' };
  }

  const { colors, size: canvasSize } = canvas;
  const halfSize = canvasSize / 2;
  const templateWidth = template.width;
  const templateHeight = template.height;

  const { data: templatePixels } = await sharpModule(template.imageData)
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });

  const startX = template.x;
  const startY = template.y;

  const startAbsX = startX + halfSize;
  const startAbsY = startY + halfSize;
  const startChunkX = Math.floor(startAbsX / TILE_SIZE);
  const startChunkY = Math.floor(startAbsY / TILE_SIZE);
  const endChunkX = Math.floor((startAbsX + templateWidth - 1) / TILE_SIZE);
  const endChunkY = Math.floor((startAbsY + templateHeight - 1) / TILE_SIZE);

  const chunks = new Map();
  const chunkPromises = [];
  for (let cy = startChunkY; cy <= endChunkY; cy += 1) {
    for (let cx = startChunkX; cx <= endChunkX; cx += 1) {
      chunkPromises.push(
        RedisCanvas.getChunk(template.canvasId, cx, cy)
          .then((chunk) => chunks.set(`${cx}:${cy}`, chunk)),
      );
    }
  }
  await Promise.all(chunkPromises);

  const resultPixels = Buffer.alloc(templateWidth * templateHeight * 4);
  let placedPixels = 0;
  let totalPixels = 0;

  for (let py = 0; py < templateHeight; py += 1) {
    for (let px = 0; px < templateWidth; px += 1) {
      const idx = (py * templateWidth + px) * 4;
      const alpha = templatePixels[idx + 3];

      if (alpha <= 200) {
        resultPixels[idx] = 0;
        resultPixels[idx + 1] = 0;
        resultPixels[idx + 2] = 0;
        resultPixels[idx + 3] = 0;
        continue;
      }

      totalPixels += 1;
      const templateR = templatePixels[idx];
      const templateG = templatePixels[idx + 1];
      const templateB = templatePixels[idx + 2];

      const canvasX = startX + px;
      const canvasY = startY + py;
      const absX = canvasX + halfSize;
      const absY = canvasY + halfSize;

      let isPlaced = false;
      if (canvasX >= -halfSize && canvasX < halfSize && canvasY >= -halfSize && canvasY < halfSize) {
        const chunkX = Math.floor(absX / TILE_SIZE);
        const chunkY = Math.floor(absY / TILE_SIZE);
        const chunk = chunks.get(`${chunkX}:${chunkY}`);

        if (chunk) {
          const offsetX = absX % TILE_SIZE;
          const offsetY = absY % TILE_SIZE;
          const colorIndex = chunk[offsetY * TILE_SIZE + offsetX];

          if (colorIndex !== undefined && colorIndex < colors.length) {
            const canvasColor = colors[colorIndex];
            if (canvasColor) {
              const [canvasR, canvasG, canvasB] = canvasColor;
              const dist = Math.sqrt(
                (templateR - canvasR) ** 2 + (templateG - canvasG) ** 2 + (templateB - canvasB) ** 2,
              );
              if (dist < 30) {
                isPlaced = true;
                placedPixels += 1;
                const gray = Math.round(0.299 * templateR + 0.587 * templateG + 0.114 * templateB);
                resultPixels[idx] = gray;
                resultPixels[idx + 1] = gray;
                resultPixels[idx + 2] = gray;
                resultPixels[idx + 3] = 255;
              }
            }
          }
        }
      }

      if (!isPlaced) {
        const blendAlpha = 0.7;
        resultPixels[idx] = Math.round(255 * blendAlpha + templateR * (1 - blendAlpha));
        resultPixels[idx + 1] = Math.round(0 * blendAlpha + templateG * (1 - blendAlpha));
        resultPixels[idx + 2] = Math.round(0 * blendAlpha + templateB * (1 - blendAlpha));
        resultPixels[idx + 3] = 255;
      }
    }
  }

  const progressPercent = totalPixels > 0 ? Math.round((placedPixels / totalPixels) * 100) : 0;

  const imageBuffer = await sharpModule(resultPixels, {
    raw: { width: templateWidth, height: templateHeight, channels: 4 },
  }).png({ compressionLevel: 6 }).toBuffer();

  return {
    success: true,
    imageBuffer,
    placedPixels,
    totalPixels,
    remainingPixels: totalPixels - placedPixels,
    progressPercent,
  };
}

async function registerCommands() {
  if (!SlashCommandBuilder || !REST || !Routes) {
    logger.error('Discord command dependencies not loaded');
    return;
  }

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

    new SlashCommandBuilder()
      .setName('timelapse')
      .setDescription('Generate a timelapse MP4 of a canvas area between two dates')
      .addStringOption((option) => option
        .setName('start_date')
        .setDescription('Start date (YYYY-MM-DD)')
        .setRequired(true))
      .addStringOption((option) => option
        .setName('end_date')
        .setDescription('End date (YYYY-MM-DD)')
        .setRequired(true))
      .addIntegerOption((option) => option
        .setName('x1')
        .setDescription('Top-left X coordinate')
        .setRequired(true))
      .addIntegerOption((option) => option
        .setName('y1')
        .setDescription('Top-left Y coordinate')
        .setRequired(true))
      .addIntegerOption((option) => option
        .setName('x2')
        .setDescription('Bottom-right X coordinate')
        .setRequired(true))
      .addIntegerOption((option) => option
        .setName('y2')
        .setDescription('Bottom-right Y coordinate')
        .setRequired(true)),
  ];

  const rest = new REST({ version: '9' }).setToken(DISCORD_BOT_TOKEN);

  try {
    logger.info('Registering Discord slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, DISCORD_GUILD_ID),
      { body: commands.map((c) => c.toJSON()) },
    );
    logger.info('Discord slash commands registered successfully');
  } catch (error) {
    logger.error(`Error registering Discord commands: ${error.message}`);
  }
}

async function handleConnectAccount(interaction) {
  const username = interaction.options.getString('username');
  const password = interaction.options.getString('password');
  const discordUserId = interaction.user.id;

  await interaction.deferReply({ ephemeral: true });

  try {
    const response = await fetch(`http://localhost:${PORT}/api/auth/local`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nameoremail: username, password }),
    });

    const data = await response.json();

    if (!response.ok || data.errors) {
      await interaction.editReply({ content: `Authentication failed: ${data.errors?.[0] || 'Invalid credentials'}` });
      return;
    }

    const success = await linkDiscordAccount(data.me.id, discordUserId);

    if (success) {
      await interaction.editReply({ content: `Successfully linked your Discord account to **${data.me.name}**!` });
    } else {
      await interaction.editReply({ content: 'Failed to link account. Please try again.' });
    }
  } catch (error) {
    logger.error(`Error in connect-account: ${error.message}`);
    await interaction.editReply({ content: 'An error occurred. Please try again later.' });
  }
}

async function handleTemplateAdd(interaction) {
  const discordUserId = interaction.user.id;

  const user = await getUserByDiscordId(discordUserId);
  if (!user) {
    await interaction.reply({ content: 'You must link your account first using `/connect-account`', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const name = interaction.options.getString('name');
  const coordinatesStr = interaction.options.getString('coordinates');
  const attachment = interaction.options.getAttachment('image');
  const canvasStr = interaction.options.getString('canvas');

  const coords = parseCoordinates(coordinatesStr);
  if (!coords) {
    await interaction.editReply({ content: 'Invalid coordinates format. Use x_y (e.g., 100_200)' });
    return;
  }

  const canvasId = parseCanvasName(canvasStr);
  if (canvasId === null) {
    await interaction.editReply({ content: 'Invalid canvas. Use: world map, minimap, or moon' });
    return;
  }

  if (!attachment.contentType?.startsWith('image/')) {
    await interaction.editReply({ content: 'Please provide a valid image file' });
    return;
  }

  try {
    const imageResponse = await fetch(attachment.url);
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    if (!sharpModule) {
      await interaction.editReply({ content: 'Image processing not available' });
      return;
    }

    const metadata = await sharpModule(imageBuffer).metadata();
    const { width, height } = metadata;

    if (width > 8192 || height > 8192) {
      await interaction.editReply({ content: 'Image too large. Maximum size is 8192x8192 pixels.' });
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
      await interaction.editReply({ content: result.error });
      return;
    }

    await interaction.editReply({
      content: `Template **${name}** added successfully!\nPosition: (${coords.x}, ${coords.y})\nSize: ${width}x${height}\nCanvas: ${canvasStr}`,
    });
  } catch (error) {
    logger.error(`Error in template-add: ${error.message}`);
    await interaction.editReply({ content: 'Failed to add template. Please try again.' });
  }
}

async function handleTemplateDelete(interaction) {
  const discordUserId = interaction.user.id;

  const user = await getUserByDiscordId(discordUserId);
  if (!user) {
    await interaction.reply({ content: 'You must link your account first using `/connect-account`', ephemeral: true });
    return;
  }

  const name = interaction.options.getString('name');

  const result = await deleteDiscordTemplate(user.id, name);

  if (result.error) {
    await interaction.reply({ content: result.error, ephemeral: true });
    return;
  }

  await interaction.reply({ content: `Template **${name}** deleted successfully!` });
}

async function handleTemplateScan(interaction) {
  const discordUserId = interaction.user.id;

  const user = await getUserByDiscordId(discordUserId);
  if (!user) {
    await interaction.reply({ content: 'You must link your account first using `/connect-account`', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const name = interaction.options.getString('name');

  const template = await getDiscordTemplate(user.id, name);
  if (!template) {
    await interaction.editReply({ content: `Template **${name}** not found` });
    return;
  }

  try {
    const result = await scanTemplate(template, canvasesData);

    if (result.error) {
      await interaction.editReply({ content: result.error });
      return;
    }

    const attachment = new MessageAttachment(result.imageBuffer, `${name}_scan.png`);

    const progressBar = '|'.repeat(Math.floor(result.progressPercent / 10)) + '.'.repeat(10 - Math.floor(result.progressPercent / 10));

    await interaction.editReply({
      content: `**Template Scan: ${name}**\n\n`
        + `Progress: [${progressBar}] **${result.progressPercent}%**\n`
        + `Placed: **${result.placedPixels.toLocaleString()}** pixels\n`
        + `Remaining: **${result.remainingPixels.toLocaleString()}** pixels\n`
        + `Total: **${result.totalPixels.toLocaleString()}** pixels\n\n`
        + 'Red = Not placed | Gray = Placed',
      files: [attachment],
    });
  } catch (error) {
    logger.error(`Error in template-scan: ${error.message}`);
    await interaction.editReply({ content: 'Failed to scan template. Please try again.' });
  }
}

async function handleTemplateList(interaction) {
  const discordUserId = interaction.user.id;

  const user = await getUserByDiscordId(discordUserId);
  if (!user) {
    await interaction.reply({ content: 'You must link your account first using `/connect-account`', ephemeral: true });
    return;
  }

  const templates = await getUserDiscordTemplates(user.id);

  if (templates.length === 0) {
    await interaction.reply({ content: 'You have no templates. Use `/template-add` to create one!', ephemeral: true });
    return;
  }

  const canvasNames = { 0: 'World Map', 1: 'Moon' };

  const list = templates.map((t, i) => {
    const canvasName = canvasNames[t.canvasId] || `Canvas ${t.canvasId}`;
    return `**${i + 1}. ${t.name}**\n   Position: (${t.x}, ${t.y}) | Size: ${t.width}x${t.height} | Canvas: ${canvasName}`;
  }).join('\n\n');

  await interaction.reply({
    content: `**Your Templates (${templates.length})**\n\n${list}`,
    ephemeral: true,
  });
}

async function handleTimelapse(interaction) {
  if (!BACKUP_URL) {
    await interaction.reply({
      content: 'Timelapse is not available: BACKUP_URL is not configured.',
      ephemeral: true,
    });
    return;
  }

  const startDateStr = interaction.options.getString('start_date');
  const endDateStr = interaction.options.getString('end_date');
  const x1 = interaction.options.getInteger('x1');
  const y1 = interaction.options.getInteger('y1');
  const x2 = interaction.options.getInteger('x2');
  const y2 = interaction.options.getInteger('y2');

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    await interaction.reply({ content: 'Invalid date format. Use YYYY-MM-DD.', ephemeral: true });
    return;
  }
  if (startDate > endDate) {
    await interaction.reply({ content: 'start_date must be before or equal to end_date.', ephemeral: true });
    return;
  }
  if (x1 >= x2 || y1 >= y2) {
    await interaction.reply({
      content: 'Invalid coordinates: x1 must be < x2 and y1 must be < y2.',
      ephemeral: true,
    });
    return;
  }

  const maxDays = 365;
  const dayDiff = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  if (dayDiff > maxDays) {
    await interaction.reply({
      content: `Range too large: maximum ${maxDays} days, got ${dayDiff}.`,
      ephemeral: true,
    });
    return;
  }

  const maxDim = 2048;
  if ((x2 - x1 + 1) > maxDim || (y2 - y1 + 1) > maxDim) {
    await interaction.reply({
      content: `Area too large: maximum ${maxDim}x${maxDim} pixels.`,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  if (!sharpModule) {
    await interaction.editReply({ content: 'Image processing (sharp) is not available.' });
    return;
  }

  try {
    const result = await generateTimelapse(sharpModule, x1, y1, x2, y2, startDateStr, endDateStr);

    if (result.error) {
      await interaction.editReply({ content: `Timelapse failed: ${result.error}` });
      return;
    }

    const attachment = new MessageAttachment(result.mp4Buffer, 'timelapse.mp4');
    await interaction.editReply({
      content: [
        `**Timelapse generated** (${result.frameCount} frames, 1 frame/sec)`,
        `Period: ${startDateStr} → ${endDateStr}`,
        `Area: (${x1}, ${y1}) → (${x2}, ${y2})`,
        `Size: ${x2 - x1 + 1}×${y2 - y1 + 1} px`,
      ].join('\n'),
      files: [attachment],
    });
  } catch (error) {
    logger.error(`Error in timelapse: ${error.message}`);
    await interaction.editReply({ content: 'An error occurred while generating the timelapse.' });
  }
}

export async function initDiscordBot(canvases) {
  if (!DISCORD_BOT_TOKEN) {
    logger.info('Discord bot token not configured, skipping bot initialization');
    return;
  }

  if (!DISCORD_GUILD_ID) {
    logger.error('DISCORD_GUILD_ID not configured, cannot initialize Discord bot');
    return;
  }

  const loaded = await loadDependencies();
  if (!loaded) {
    logger.error('Failed to load Discord dependencies, skipping bot initialization');
    return;
  }

  canvasesData = canvases;

  client = new Client({
    intents: [
      Intents.FLAGS.GUILDS,
    ],
  });

  client.once('ready', async () => {
    logger.info(`Discord bot logged in as ${client.user.tag}`);
    await registerCommands();
    startStatusCheck(client);
    startVoidPing(client);
  });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

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
        case 'timelapse':
          await handleTimelapse(interaction);
          break;
        default:
          break;
      }
    } catch (error) {
      logger.error(`Error handling command ${commandName}: ${error.message}`);
      const reply = { content: 'An error occurred while processing your command.', ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(reply).catch(() => {});
      } else {
        await interaction.reply(reply).catch(() => {});
      }
    }
  });

  client.on('error', (error) => {
    logger.error(`Discord client error: ${error.message}`);
  });

  try {
    await client.login(DISCORD_BOT_TOKEN);
  } catch (error) {
    logger.error(`Failed to login Discord bot: ${error.message}`);
  }
}

export function getDiscordClient() {
  return client;
}
