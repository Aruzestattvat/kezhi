const parser = require('./parser');

function cleanInput(text) {
  return String(text || '')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/(?:&#x20;|&#32;|&nbsp;)/gi, ' ')
    .replace(/\\([#~])/g, '$1')
    .replace(/\r/g, '')
    .trim();
}

function trimOrderDecoration(line) {
  return String(line || '').trim().replace(/^[\s#*•·●○▪▫■□◆◇★☆▶▷➡→🚩⚑⚐🔴🟠🟡🟢🔵🟣❤♥🔥📌✅❗‼！]+/u, '').trim();
}

function isLikelyDateOrPhoneCode(digits) {
  return /^1[3-9]\d{9}$/.test(digits) || (
    /^20\d{10,12}$/.test(digits) &&
    Number(digits.slice(4, 6)) >= 1 && Number(digits.slice(4, 6)) <= 12 &&
    Number(digits.slice(6, 8)) >= 1 && Number(digits.slice(6, 8)) <= 31
  );
}

function orderHeaderInfo(line) {
  const value = trimOrderDecoration(line);
  if (/^[【\[]?\s*嘉兴家教\s*\d{5,10}\s*[】\]]?/.test(value)) return { kind: 'known' };
  if (/^(?:嘉兴\s*\d{5,8}|育林\s*100\d{4}|(?:开学后\s*)?dt\s*\d{6,10}|xc\s*\d{6,10}[a-z]?|jx(?:ot|qt)\s*\d{8,18}[a-z]?)/i.test(value)) return { kind: 'known' };
  const numeric = value.match(/^(\d{9,18})(?=\D|$)/);
  if (numeric && !isLikelyDateOrPhoneCode(numeric[1])) return { kind: 'numeric' };
  return null;
}

function hasOrderFieldGroup(text) {
  const value = String(text || '');
  const groups = [
    /(?:联系地址|学员地址|学生地址|家庭地址|上课地址|授课地址|家教地址|辅导地址|上课地点|辅导地点|地址|地点|位置|住址|家住)\s*[】\]]?\s*[:：]?/i,
    /(?:年级科目|辅导科目|科目|内容|年级|学员情况|学生情况)\s*[】\]]?\s*[:：]?/i,
    /(?:薪资待遇|老师薪水|老师课费|薪资|课费|价格|报酬|时薪)\s*[】\]]?\s*[:：]?/i
  ];
  return groups.filter((pattern) => pattern.test(value)).length >= 2;
}

function trimPromotionFooter(text) {
  const lines = String(text || '').split('\n');
  const start = lines.findIndex((line) => /(?:^|\\?#)\s*(?:身边有同学想做家教|群内家教订单可直接转发|推荐的朋友.*接单试课|欢迎多多推荐|拉同学进群接单|现金红包)/.test(line.trim()));
  return (start >= 0 ? lines.slice(0, start) : lines).join('\n').trim();
}

function splitOrdersWithinRecord(block) {
  const lines = String(block || '').split('\n');
  const candidates = [];
  lines.forEach((line, index) => {
    const info = orderHeaderInfo(line);
    if (info) candidates.push(Object.assign({}, info, { index }));
  });
  if (candidates.length < 2) return [block];
  const accepted = candidates.filter((candidate, index) => {
    const until = candidates[index + 1] ? candidates[index + 1].index : lines.length;
    return candidate.kind === 'known' || hasOrderFieldGroup(lines.slice(candidate.index, until).join('\n'));
  });
  if (accepted.length < 2) return [block];
  const preamble = lines.slice(0, accepted[0].index).join('\n').trim();
  return accepted.map((candidate, index) => {
    const until = accepted[index + 1] ? accepted[index + 1].index : lines.length;
    const body = trimPromotionFooter(lines.slice(candidate.index, until).join('\n'));
    return [preamble, body].filter(Boolean).join('\n');
  }).filter(Boolean);
}

function splitWechatRecords(text) {
  const lines = String(text || '').split('\n');
  const starts = [];
  const timestamp = /^(?:(?:20\d{2}年)?\d{1,2}月\d{1,2}日|20\d{2}[\/-]\d{1,2}[\/-]\d{1,2}|今天|昨天|前天|星期[一二三四五六日天]|周[一二三四五六日天])(?:\s+星期[一二三四五六日天])?\s+(?:上午|下午|晚上|中午)?\s*\d{1,2}:\d{2}(?::\d{2})?$/;
  const field = /^[【\[]?\s*(?:内容|要求|薪资|价格|报酬|课费|时间|地点|地址|年级|科目|学员|学生|老师|教员)\s*[】\]]?\s*[:：]/;
  for (let index = 0; index < lines.length - 1; index += 1) {
    const sender = lines[index].trim();
    const postedAt = lines[index + 1].trim();
    if (sender && sender.length <= 80 && !field.test(sender) && timestamp.test(postedAt)) starts.push(index);
  }
  if (!starts.length) return [];
  const records = [];
  if (starts[0] > 0) {
    const prefix = lines.slice(0, starts[0]).join('\n').trim();
    if (prefix) records.push(prefix);
  }
  starts.forEach((start, index) => {
    const record = lines.slice(start, starts[index + 1] || lines.length).join('\n').trim();
    if (record) records.push(record);
  });
  return records;
}

function isStandalonePriceFragment(text) {
  const value = String(text || '').trim();
  return /^(?:[【\[]?\s*)?(?:薪资|课费|老师课费|老师薪水|价格|报酬)\s*[】\]]?\s*[:：]/.test(value) && parser.isPlaceholder(value);
}

function splitMessages(text) {
  const cleaned = cleanInput(text);
  if (!cleaned) return [];
  let blocks = splitWechatRecords(cleaned);
  if (blocks.length) {
    blocks = blocks.reduce((all, block) => all.concat(splitOrdersWithinRecord(block)), []);
  } else {
    const headerSplit = splitOrdersWithinRecord(cleaned);
    if (headerSplit.length > 1) {
      blocks = headerSplit;
    } else {
      const paragraphs = cleaned.split(/\n\s*\n+/).map((item) => item.trim()).filter(Boolean);
      blocks = paragraphs.length > 1 && paragraphs.every((part) => hasOrderFieldGroup(part) || parser.isPlaceholder(part)) ? paragraphs : [cleaned];
    }
  }
  blocks = blocks.filter((block) => !/^[-—－]{2,}\s*课值测算\s*[-—－]{2,}/.test(block));
  const merged = [];
  blocks.forEach((block) => {
    if (isStandalonePriceFragment(block) && merged.length) merged[merged.length - 1] += `\n${block}`;
    else merged.push(block);
  });
  blocks = merged;
  if (blocks.length === 1) {
    const lines = cleaned.split('\n').map((item) => item.trim()).filter(Boolean);
    const probable = lines.filter((line) => /(数学|英语|语文|物理|化学|科学|编程|家教)/.test(line) && /\d+(?:\.\d+)?\s*(?:元|\/\s*(?:h|小时)|每小时)/i.test(line));
    if (probable.length > 1) blocks = probable;
  }
  return blocks.filter((block) => !parser.isPlaceholder(block) && !isStandalonePriceFragment(block));
}

module.exports = {
  cleanInput,
  splitMessages,
  splitWechatRecords,
  splitOrdersWithinRecord,
  hasOrderFieldGroup
};
