(function(root,factory){
  const api=factory();
  root.TutorParser=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const periodPattern='上午|下午|晚上|晚间|中午|早上|早晨|凌晨';
  const cnDigits={'零':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};

  function chineseNumber(value){
    if(!value)return null;
    if(/^\d+(?:\.\d+)?$/.test(value))return Number(value);
    if(value==='十')return 10;
    if(value.includes('十')){
      const [left,right]=value.split('十');
      return (left?cnDigits[left]??0:1)*10+(right?cnDigits[right]??0:0);
    }
    return cnDigits[value]??null;
  }

  function clockFromToken(token,inheritedPeriod=''){
    const period=(token.match(new RegExp(periodPattern))||[])[0]||inheritedPeriod;
    const match=token.match(/(\d{1,2}|[一二两三四五六七八九十]{1,3})(?::([0-5]?\d)|点\s*(半|[0-5]?\d)?|时\s*(半|[0-5]?\d)?)(?:分)?/);
    if(!match)return null;
    let hour=chineseNumber(match[1]);
    if(!Number.isFinite(hour)||hour>23)return null;
    const minuteToken=match[2]??match[3]??match[4]??'0';
    const minute=minuteToken==='半'?30:Number(minuteToken||0);
    if(!Number.isFinite(minute)||minute>59)return null;
    if(/下午|晚上|晚间/.test(period)&&hour<12)hour+=12;
    if(period==='中午'&&hour<11)hour+=12;
    if(/上午|早上|早晨|凌晨/.test(period)&&hour===12)hour=0;
    return {minutes:hour*60+minute,period};
  }

  function detectTimeRange(text){
    const alternativeEnd=text.match(new RegExp(`((?:${periodPattern})?\\s*(\\d{1,2}))\\s*(?:-|—|–|~|～|至|到)\\s*(\\d{1,2})\\s*(?:/|／|或)\\s*(\\d{1,2})\\s*点`));
    if(alternativeEnd){
      const period=(alternativeEnd[1].match(new RegExp(periodPattern))||[])[0]||'',start=clockFromToken(`${period}${alternativeEnd[2]}点`),ends=[clockFromToken(`${alternativeEnd[3]}点`,period),clockFromToken(`${alternativeEnd[4]}点`,period)].filter(Boolean);
      if(start&&ends.length===2){const hours=ends.map(end=>{let minutes=end.minutes;while(minutes<=start.minutes)minutes+=12*60;return(minutes-start.minutes)/60}).filter(value=>value>=0.25&&value<=8);if(hours.length===2)return {hours:Math.min(...hours),hoursMax:Math.max(...hours),source:'time-range',matched:alternativeEnd[0].trim()}}
    }
    const sharedUnit=text.match(new RegExp(`((?:${periodPattern})?\\s*(\\d{1,2}))\\s*(?:-|—|–|~|～|至|到)\\s*(\\d{1,2})\\s*点`));
    if(sharedUnit){
      const period=(sharedUnit[1].match(new RegExp(periodPattern))||[])[0]||'';
      const start=clockFromToken(`${period}${sharedUnit[2]}点`);
      const end=clockFromToken(`${sharedUnit[3]}点`,period);
      if(start&&end){let endMinutes=end.minutes;while(endMinutes<=start.minutes)endMinutes+=12*60;const hours=(endMinutes-start.minutes)/60;if(hours>=0.25&&hours<=8)return {hours,hoursMax:hours,source:'time-range',matched:sharedUnit[0].trim()}}
    }
    const clock='(?:\\d{1,2}|[一二两三四五六七八九十]{1,3})(?::[0-5]?\\d|点\\s*(?:半|[0-5]?\\d)?|时\\s*(?:半|[0-5]?\\d)?)';
    const pattern=new RegExp(`([^，,。；;\\n]{0,18}?(?:${periodPattern})?\\s*${clock})\\s*(?:-|—|–|~|～|至|到)\\s*((?:(?:${periodPattern})\\s*)?${clock})`,'g');
    let match;
    while((match=pattern.exec(text))){
      const start=clockFromToken(match[1]);
      const end=clockFromToken(match[2],start?.period||'');
      if(!start||!end)continue;
      let endMinutes=end.minutes;
      while(endMinutes<=start.minutes)endMinutes+=12*60;
      const hours=(endMinutes-start.minutes)/60;
      if(hours>=0.25&&hours<=8)return {hours,hoursMax:hours,source:'time-range',matched:match[0].trim()};
    }
    return null;
  }

  function detectExplicitDuration(text){
    const contextual=text.match(/(?:每次|一次|单次|每节(?:课)?|一节(?:课)?)\s*(?:上课)?\s*(\d+(?:\.\d+)?|[一二两三四五六七八九十]{1,3})(?:个)?(?:小时|钟头|h\b)(半)?/i);
    if(contextual){let hours=chineseNumber(contextual[1]);if(contextual[2])hours+=0.5;if(hours>=0.25&&hours<=8)return {hours,hoursMax:hours,source:'explicit-duration',matched:contextual[0]}}
    const oneAndHalf=text.match(/(?:一|1)个半小时/);
    if(oneAndHalf)return {hours:1.5,hoursMax:1.5,source:'explicit-duration',matched:oneAndHalf[0]};
    const rangeMatch=text.match(/(\d+(?:\.\d+)?)\s*(?:-|—|–|~|～|至|到)\s*(\d+(?:\.\d+)?)\s*(?:h\b|小时|钟头)/i);
    if(rangeMatch){const low=Math.min(Number(rangeMatch[1]),Number(rangeMatch[2])),high=Math.max(Number(rangeMatch[1]),Number(rangeMatch[2]));if(low>=0.25&&high<=8)return {hours:low,hoursMax:high,source:'duration-range',matched:rangeMatch[0]}}
    if(/(?:半个?小时|半小时)/.test(text))return {hours:0.5,hoursMax:0.5,source:'explicit-duration',matched:(text.match(/(?:半个?小时|半小时)/)||[])[0]};
    const durationText=text.replace(/\d+(?:\.\d+)?\s*(?:-|—|–|~|～|至|到)\s*\d+(?:\.\d+)?\s*元\s*(?:一|每)(?:个)?小时/gi,'').replace(/\d+(?:\.\d+)?\s*元\s*(?:一|每)(?:个)?小时/gi,'');
    const hourMatch=durationText.match(/(\d+(?:\.\d+)?|[一二两三四五六七八九十]{1,3})(?:个)?(?:小时|钟头|h\b)(半)?/i);
    if(hourMatch){
      let hours=chineseNumber(hourMatch[1]);
      if(hourMatch[2])hours+=0.5;
      const minuteAfter=durationText.slice((hourMatch.index||0)+hourMatch[0].length).match(/^\s*(\d{1,3}|[一二两三四五六七八九十]{1,3})\s*分钟/);
      if(minuteAfter)hours+=chineseNumber(minuteAfter[1])/60;
      if(hours>=0.25&&hours<=8)return {hours,hoursMax:hours,source:'explicit-duration',matched:hourMatch[0]+(minuteAfter?.[0]||'')};
    }
    const minuteMatch=text.match(/(\d{1,3}|[一二两三四五六七八九十]{1,3})\s*分钟/);
    if(minuteMatch){const hours=chineseNumber(minuteMatch[1])/60;if(hours>=0.25&&hours<=8)return {hours,hoursMax:hours,source:'explicit-duration',matched:minuteMatch[0]}}
    return null;
  }

  function detectDuration(text){return detectTimeRange(text)||detectExplicitDuration(text)||{hours:null,hoursMax:null,source:'none',matched:''}}

  function parseGrade(text){
    const gradeNames=['','一','二','三','四','五','六','七','八','九'];
    const label=n=>gradeNames[n]?`${gradeNames[n]}年级`:`${n}年级`;
    const grades=[];
    const transition=/([一二三四五六七八九1-9])\s*升\s*([一二三四五六七八九1-9])/g;let match;
    while((match=transition.exec(text))){const target=chineseNumber(match[2]);if(target)grades.push(label(target))}
    const direct=/(幼儿园|学前班|初[一二三123]|高[一二三123]|[一二三四五六七八九1-9]\s*年级)/g;
    while((match=direct.exec(text))){
      const value=match[1].replace(/\s/g,'');
      if(/年级$/.test(value)){const n=chineseNumber(value.replace('年级',''));grades.push(label(n))}
      else grades.push(value.replace('初1','初一').replace('初2','初二').replace('初3','初三').replace('高1','高一').replace('高2','高二').replace('高3','高三'));
    }
    return [...new Set(grades)].join('/');
  }

  function parseSubject(text){
    const names=['全科','作业辅导','作业','数学','英语','语文','物理','化学','生物','地理','历史','政治','科学','编程','信息技术','音乐','美术'];
    const found=names.filter(name=>text.includes(name));
    if(found.includes('作业辅导'))return found.filter(name=>name!=='作业').join('/');
    return found.join('/');
  }

  function parseCompensation(text,durationHours=null,durationHoursMax=durationHours){
    const validRate=rate=>Number.isFinite(rate)&&rate>=10;
    const range=text.match(/(\d+(?:\.\d+)?)\s*(?:元)?\s*(?:-|—|–|~|～|至|到)\s*(\d+(?:\.\d+)?)\s*(?:元)?\s*(?:\/\s*(?:h|小时)|每小时|(?:一|每)(?:个)?小时)(?=\s|[，,。；;（(]|$|\d+(?:\.\d+)?\s*(?:h\b|小时|钟头))/i);
    if(range){const low=Math.min(Number(range[1]),Number(range[2])),high=Math.max(Number(range[1]),Number(range[2]));if(validRate(low))return {hourlyRate:low,hourlyRateMin:low,hourlyRateMax:high,totalPrice:null,matched:range[0]}}
    const hourly=text.match(/(\d+(?:\.\d+)?)\s*(?:元)?\s*(?:(?:\/|每)\s*(?:小时|时|h)|(?:一|每)(?:个)?小时)(?=\s|[，,。；;（(]|$|\d+(?:\.\d+)?\s*(?:h\b|小时|钟头))|(?:每小时|一小时|时薪|课时费|老师薪水)[^\d]{0,8}(\d+(?:\.\d+)?)/i);
    if(hourly){const rate=Number(hourly[1]||hourly[2]);if(validRate(rate))return {hourlyRate:rate,hourlyRateMin:rate,hourlyRateMax:rate,totalPrice:null,matched:hourly[0]}}
    const over=text.match(/(\d+(?:\.\d+)?)\s*(?:元)?\s*[\/／]\s*(\d+(?:\.\d+)?)\s*(?:小时|h)/i);
    if(over){const total=Number(over[1]),hours=Number(over[2]),rate=total/hours;if(validRate(rate))return {hourlyRate:rate,hourlyRateMin:rate,hourlyRateMax:rate,totalPrice:total,matched:over[0]}}
    const sessionRange=text.match(/(\d+(?:\.\d+)?)\s*(?:元)?\s*(?:-|—|–|~|～|至|到)\s*(\d+(?:\.\d+)?)\s*(?:元)?\s*(?:每次|一次|每节|一节)/);
    if(sessionRange&&durationHours){const totalLow=Math.min(Number(sessionRange[1]),Number(sessionRange[2])),totalHigh=Math.max(Number(sessionRange[1]),Number(sessionRange[2])),maxHours=Number.isFinite(durationHoursMax)?durationHoursMax:durationHours,low=totalLow/maxHours,high=totalHigh/durationHours;if(validRate(low))return {hourlyRate:low,hourlyRateMin:low,hourlyRateMax:high,totalPrice:totalLow,totalPriceMax:totalHigh,matched:sessionRange[0]}}
    const sessionWithYuan=text.match(/(\d+(?:\.\d+)?)\s*元\s*(?:一次|每次|一节|每节|次|节)/);
    const sessionEach=text.match(/(\d+(?:\.\d+)?)\s*(?:每次|一次|每节|一节)|(?:每次|一次|每节|一节)\s*(\d+(?:\.\d+)?)\s*元?/);
    const session=sessionWithYuan||sessionEach;
    if(session&&durationHours){const total=Number(session[1]||session[2]),maxHours=Number.isFinite(durationHoursMax)?durationHoursMax:durationHours,low=total/maxHours,high=total/durationHours;if(validRate(low))return {hourlyRate:low,hourlyRateMin:low,hourlyRateMax:high,totalPrice:total,totalPriceMax:total,matched:session[0]}}
    return {hourlyRate:null,hourlyRateMin:null,hourlyRateMax:null,totalPrice:null,matched:''};
  }

  function parseFrequency(text){
    const value='\\d+(?:\\.\\d+)?|[一二两三四五六七]';
    const range=text.match(new RegExp(`(?:一周|每周|周内|周末)\\s*(${value})\\s*(?:-|—|–|~|～|至|到)\\s*(${value})\\s*次`));
    if(range){let min=chineseNumber(range[1]),max=chineseNumber(range[2]);if(/周日\s*(?:一|1)次/.test(text)){min+=1;max+=1}return {weeklyTimes:Math.min(min,max),weeklyTimesMax:Math.max(min,max),matched:range[0]}}
    const chosen=text.match(new RegExp(`周一\\s*(?:到|至|-)\\s*周五.{0,10}?(?:中选?|选)\\s*(${value})\\s*(?:天|次)`));
    if(chosen){const count=chineseNumber(chosen[1]);return {weeklyTimes:count,weeklyTimesMax:count,matched:chosen[0]}}
    if(/周一\s*(?:到|至|-)\s*周五.{0,10}?每天/.test(text))return {weeklyTimes:5,weeklyTimesMax:5,matched:'周一到周五每天'};
    if(/周一\s*(?:到|至|-)\s*周五/.test(text))return {weeklyTimes:5,weeklyTimesMax:5,matched:'周一到周五'};
    const single=text.match(new RegExp(`(?:一周|每周|周内|周末)\\s*(?:上午|下午|晚上|白天|早上|早晨|中午)?\\s*(?:每门\\s*)?(${value})\\s*次`));
    if(single){const count=chineseNumber(single[1]);return {weeklyTimes:count,weeklyTimesMax:count,matched:single[0]}}
    const shorthand=text.match(/周([1-7]{2,7})/);if(shorthand){const count=new Set(shorthand[1].split('')).size;return {weeklyTimes:count,weeklyTimesMax:count,matched:shorthand[0]}}
    const alternatives=text.match(/([1-7]{2,7})\s*或\s*([1-7]{2,7})/);if(alternatives){const count=Math.min(new Set(alternatives[1]).size,new Set(alternatives[2]).size);return {weeklyTimes:count,weeklyTimesMax:count,matched:alternatives[0]}}
    return {weeklyTimes:1,weeklyTimesMax:1,matched:''};
  }

  function trimOrderDecoration(line){return String(line||'').trim().replace(/^[\s#*•·●○▪▫■□◆◇★☆▶▷➡→🚩⚑⚐🔴🟠🟡🟢🔵🟣❤♥🔥📌✅❗‼！]+/u,'').trim()}
  function validGenericCode(digits){return !/^1[3-9]\d{9}$/.test(digits)&&!(/^20\d{10,12}$/.test(digits)&&Number(digits.slice(4,6))>=1&&Number(digits.slice(4,6))<=12&&Number(digits.slice(6,8))>=1&&Number(digits.slice(6,8))<=31)}
  function extractOrderCode(text){
    const bracketed=text.match(/[【\[]\s*嘉兴家教\s*(\d{5,10})\s*[】\]]/);if(bracketed)return bracketed[1];
    const yulin=text.match(/(?:育林\s*)?(100\d{4})/);if(yulin)return yulin[1];
    const jiaxing=text.match(/(?:^|\n)\s*嘉兴\s*(\d{5,8})\b/);if(jiaxing)return jiaxing[1];
    const dt=text.match(/\bdt\s*(\d{6,10})\b/i);if(dt)return`dt${dt[1]}`;
    const xc=text.match(/\bxc\s*(\d{6,10})([a-z]?)\b/i);if(xc)return`xc${xc[1]}${(xc[2]||'').toLowerCase()}`;
    for(const line of String(text||'').split('\n')){const value=trimOrderDecoration(line),jx=value.match(/^(jx(?:ot|qt)\s*\d{8,18}[a-z]?)/i);if(jx)return jx[1].replace(/\s/g,'').toUpperCase();const numeric=value.match(/^(\d{9,18})(?=\D|$)/);if(numeric&&validGenericCode(numeric[1]))return numeric[1]}
    return'';
  }
  function extractPostedAt(text){return (text.match(/(?:(?:20\d{2}年)?\d{1,2}月\d{1,2}日|20\d{2}[\/-]\d{1,2}[\/-]\d{1,2}|今天|昨天|前天|星期[一二三四五六日天]|周[一二三四五六日天])(?:\s+星期[一二三四五六日天])?\s+(?:上午|下午|晚上|中午)?\s*\d{1,2}:\d{2}(?::\d{2})?/)||[])[0]?.trim()||''}
  function isPlaceholder(text){
    const value=String(text||'');if(/\[聊天记录\]/.test(value)||/^[-—－]{2,}\s*课值测算/.test(value))return true;
    const hasAddress=/(?:联系地址|学员地址|学生地址|家庭地址|上课地址|授课地址|家教地址|辅导地址|上课地点|辅导地点|地址|地点|位置|住址|家住)\s*[】\]]?\s*[:：]?/i.test(value);
    const hasGrade=/(?:年级科目|学员情况|年级)\s*[】\]]?\s*[:：]|幼儿园|学前班|初[一二三123]|高[一二三123]|[一二三四五六七八九1-9]\s*年级/.test(value);
    const hasSubject=/(?:辅导科目|年级科目|科目)\s*[】\]]?\s*[:：]|全科|作业辅导|数学|英语|语文|物理|化学|科学|编程/.test(value);
    return !(hasAddress||hasGrade||hasSubject);
  }

  function teacherRequirementText(text){
    const lines=String(text||'').split(/\n/).map(line=>line.trim()).filter(line=>/(?:教员|老师|教师|家教)要求|^要求\s*[:：，,]/.test(line));
    const explicit=String(text||'').match(/(?:男|女)(?:老师|教师|教员)/g)||[];
    return `${lines.join(' ')} ${explicit.join(' ')}`.trim();
  }

  function parseTeacherGenderRequirement(text){
    const scope=teacherRequirementText(text);if(!scope)return 'any';
    if(/男女不限|男女皆可|性别不限|男女均可|男生女生均可|不[限要]男女/.test(scope))return 'any';
    const female=/(?:只要|仅限|限|要|需要|找)?\s*(?:女老师|女教师|女教员|女生|女性)|(?:^|[:：，,\s])女(?=[，,。；;\s]|$)/.test(scope);
    const male=/(?:只要|仅限|限|要|需要|找)?\s*(?:男老师|男教师|男教员|男生|男性)|(?:^|[:：，,\s])男(?=[，,。；;\s]|$)/.test(scope);
    if(female&&!male)return 'female';if(male&&!female)return 'male';return 'any';
  }

  function requiresEmployedTeacher(text){
    const value=String(text||''),scope=teacherRequirementText(value)||value;
    const identity='(?:在职|专职|全职|在编|编制|一线|学校|机构|退休|职业)';
    const teacher='(?:老师|教师|教员|家教)';
    if(new RegExp(`(?:不要求|无需|不需要|不限|非)\\s*${identity}\\s*(?:的\\s*)?${teacher}`).test(scope))return false;
    const explicitHashtag=/(?:[#＃])\s*(?:在职|专职|全职|在编)(?=[#＃\s，,。；;\n]|$)/.test(value);
    return explicitHashtag||new RegExp(`${identity}\\s*(?:(?:[/／、]|或)\\s*[^，,。；;\\n]{0,6})?(?:的\\s*)?${teacher}|${teacher}[^，,。；;\\n]{0,8}${identity}`).test(scope);
  }

  function hasTransportReimbursement(text){
    const value=String(text||'');
    if(/(?:不|无|没有|不予|不能|无法|概不)\s*(?:报销|补贴)[^，,。；;\n]{0,10}(?:打车费|车费|路费|交通费)|(?:打车费|车费|路费|交通费)[^，,。；;\n]{0,8}(?:不|无|没有|不予|不能|无法|概不)\s*(?:报销|补贴)/.test(value))return false;
    return /(?:报销|补贴)[^，,。；;\n]{0,10}(?:打车费|车费|路费|交通费)|(?:打车费|车费|路费|交通费)[^，,。；;\n]{0,8}(?:报销|补贴)|(?:往返)?车补|交通补贴|(?:路费|车费|交通费|打车费)[^，,。；;\n]{0,6}实报实销/.test(value);
  }

  return {detectDuration,detectTimeRange,detectExplicitDuration,parseGrade,parseSubject,parseCompensation,parseFrequency,extractOrderCode,extractPostedAt,isPlaceholder,parseTeacherGenderRequirement,requiresEmployedTeacher,hasTransportReimbursement};
});
