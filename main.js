require('dotenv').config();

const fs = require('fs');
const cors = require('cors');
const cron = require('node-cron');
const express = require('express');
const axiosClassic = require('axios');
const date = require('date-and-time');
const rateLimit = require('axios-rate-limit');
const TelegramBot = require('node-telegram-bot-api');

const app = express();

const axios = rateLimit(axiosClassic.create(), { maxRPS: 50 });

const token = process.env.TOKEN;
const ChannelId = process.env.ID;

const bot = new TelegramBot(token, { polling: true });

let hours;
const categories = ['front-end', 'backend', 'cli', 'documentation', 'css', 'testing', 'iot', 'coverage', 'mobile', 'framework', 'robotics', 'math'];
const phrases = [
  'А вот и новый пакет!',
  'Какая неожиданность, ведь вышел новый пакет!',
  `${hours} часов как раз то время, чтобы рассказать тебе о новом пакете!`,
  'Если ты искал годный пакет, то тебе сюда!',
  'Мы снова рады тебя видеть!',
  'Не давай злым силам одолеть тебя, а лучше возьми новый пакет!',
  'Если что, в пакетах, которые мы тебе даем - ничего запрещенного нет, так что не переживай)',
  'Возможности купить счастье нет, но у тебя есть возможность чекнуть новый пакет ( что впринципе одно и тоже :) )',
  'IF(ты не счастлив) {дать пакет} ELSE {все равно дать пакет}',
  'Конечно ты можешь начать день с чего-то другого, но лучше начни его с нового фреймворка!',
  'Никогда не поздно начать день с нового фреймворка!',
  'Как-никак, а пакеты всегда будут появляться!',
  'А кто тут у нас ещё пакет не чекнул, а?',
];

async function updateDate() {
  const later = new Date();
  const start = new Date();
  const end = new Date();

  start.setDate(start.getDate() - 7);
  later.setDate(later.getDate() - 14);

  return {
    laterDate: date.format(later, 'YYYY-MM-DD'),
    endDate: date.format(end, 'YYYY-MM-DD'),
    startDate: date.format(start, 'YYYY-MM-DD'),
  };
}

async function get() {
  const results = [];

  for (const item of categories) {
    const { data } = await axios.get(`https://api.npms.io/v2/search/?q=keywords:${item}+popularity-weight:100`);
    results.push(data.results);
  }
  return results;
}

let serverData = null;

async function output(finalResult) {
  const { laterDate, startDate } = await updateDate();

  let PackageNumber = Math.floor(Math.random() * finalResult.length);
  const {
    name, link, description, date, downloads,
  } = finalResult[PackageNumber];

  const random = Math.floor(Math.random() * phrases.length);
  const { data } = await axios.get(`https://api.npmjs.org/downloads/point/${laterDate}:${startDate}/${name}`);
  const percent = Math.floor((downloads * 100 / data.downloads));

  try {
    if (JSON.parse(fs.readFileSync('blacklist.json', 'utf8')).indexOf(name) === -1 && percent > 85 && downloads >= 1000 && downloads < 3000000 && date.split('T')[0].split('-')[0] >= 2020) {
      const temp = JSON.parse(fs.readFileSync('blacklist.json', 'utf8'));
      temp.push(name);

      bot.sendMessage(ChannelId, `${phrases[random]}\n\n☑ Название: ${name}\n📋 Описание: ${description}\n📊 Скачивания за неделю: ${downloads}\n⚡ Ссылка: ${link}\n📅 Дата создания: ${date.split('T')[0]}`);

      serverData = {
        name,
        description,
        downloads,
        date: date.split('T')[0],
        link,
      };

      fs.writeFileSync('blacklist.json', JSON.stringify(temp));
    } else {
      PackageNumber = Math.floor(Math.random() * finalResult.length);
      await output(finalResult);
    }
  } catch (e) {
    console.log(e);
    await output(finalResult);
  }
}

cron.schedule('*/1 * * * *', async () => {
  const content = await get();

  const phraseHours = new Date();
  hours = phraseHours.getHours();

  const { endDate, startDate } = await updateDate();

  const result = await Promise.all(
    content.map(async (item) => Promise.all(item.map(async ({
      name, description, date, links,
    }) => {
      const { data } = await axios.get(`https://api.npmjs.org/downloads/point/${startDate}:${endDate}/${name}`);

      return {
        name,
        description,
        date,
        link: links.npm,
        downloads: data.downloads,
      };
    }))),
  );

  const finalResult = result.flat().sort((a, b) => new Date(b.date) - new Date(a.date));

  await output(finalResult, hours);
  console.log(serverData);
}, {
  timezone: 'Europe/Kiev',
});

app.use(cors());

app.get('/', (req, res) => {
  res.send({
    result: serverData || null,
  });
});

const port = 3000;

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
