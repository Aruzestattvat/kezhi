const fs=require('fs');
const vm=require('vm');
const parser=require('./internal-release-source/parser.js');

const element=()=>({innerHTML:'',textContent:'',value:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){},showModal(){},close(){}});
const elements=new Map();
const document={querySelector(selector){if(!elements.has(selector))elements.set(selector,element());return elements.get(selector)},querySelectorAll(){return[]},addEventListener(){},activeElement:null};
const storage=new Map();
const context={console,document,TutorParser:parser,structuredClone,crypto:require('crypto').webcrypto,setTimeout,clearTimeout,Blob,URL,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},confirm:()=>false,FormData:class{}};
vm.createContext(context);
vm.runInContext(fs.readFileSync('work/internal-release-source/app.js','utf8'),context);

const sample=`💤
2026年08月25日 14:47
育林1002693 南湖开学
学员地址：嘉报广场
辅导科目：科学
学员情况：开学八年级 男生
时间安排：周六下午2-3h
老师薪水：80/h

💤
2026年08月25日 16:29
[聊天记录]

💤
2026年08月25日 16:39
育林1002689 南湖开学
学员地址：当代华府
辅导科目：全科
学员情况：五年级 男生
时间安排：周一到周五晚上，一次2h
老师薪水：60/h`;

const result=vm.runInContext(`splitMessages(${JSON.stringify(sample)}).map(x=>parseOrder(x,'测试群'))`,context);
console.log(JSON.stringify(result.map(o=>({code:o.orderCode,grade:o.grade,subject:o.subject,address:o.address,rate:[o.hourlyRate,o.hourlyRateMax],hours:[o.hours,o.hoursMax],weekly:[o.weeklyTimes,o.weeklyTimesMax],ambiguous:o.addressAmbiguous})),null,2));
const addressCases=vm.runInContext(`[
  parseOrder('嘉兴安欣老师（发单人）\\n五年级数学 80/h','测试群').address,
  parseOrder('嘉兴安欣老师（发单人）\\n学员地址：万朵城附近\\n五年级数学 80/h','测试群').address,
  parseOrder('初二数学，地点：巴黎都市，120元/小时','测试群').address,
  parseOrder('五年级作业辅导\\n地址 平湖市税务局附近\\n60/h','测试群').address
]`,context);
if(addressCases[0]!==''||addressCases[1]!=='万朵城'||addressCases[2]!=='巴黎都市'||addressCases[3]!=='平湖市税务局')throw new Error(`严格地址前缀识别错误：${JSON.stringify(addressCases)}`);
console.log('STRICT_ADDRESS_PREFIX_OK');
const bracketedWechatSample=`嘉兴082135
【上课地址】：南湖区大朱楼
【年级科目】：新六年级数学
【学员情况】：男，基础差
【时间安排】：周末上午两次课，一次两小时
【老师要求】：有家教经验，有责任心，
【老师课费】：60/h
\u200b
\u200b嘉兴0824121
【上课地址】：桐乡巨成·望湖湾
【年级科目】：新三年级全科作业辅导
【学员情况】：男
【时间安排】：开学周一-周五，一次两小时
【老师要求】：已毕业优先，有家教经验，有责任心，
【老师课费】：60/h

——课值测算——
薪资：60元/小时`;
const bracketedOrders=vm.runInContext(`splitMessages(${JSON.stringify(bracketedWechatSample)}).map(x=>parseOrder(x,'嘉兴大学生家教群'))`,context);
const bracketedSummary=bracketedOrders.map(o=>({code:o.orderCode,address:o.address,grade:o.grade,subject:o.subject,hours:o.hours,weekly:o.weeklyTimes}));
if(bracketedOrders.length!==2||bracketedSummary[0].code!=='082135'||bracketedSummary[0].address!=='南湖区大朱楼'||bracketedSummary[0].weekly!==2||bracketedSummary[1].code!=='0824121'||bracketedSummary[1].address!=='桐乡巨成·望湖湾'||bracketedSummary[1].weekly!==5)throw new Error(`微信括号字段或分单识别错误：${JSON.stringify(bracketedSummary)}`);
console.log('BRACKETED_WECHAT_ORDERS_OK');
const chloeBatchSample=`Chloe
2026年08月27日 19:14
#余单
【嘉兴家教 35942937】
联系地址：桐乡市翡翠天御府
年级性别：初二，男
辅导科目：数学,科学
时间安排：开学周一到周四晚上1小时，周五到周天每天2个小时
教员要求：男女不限，数理化好 #长期带
薪资待遇：80~90元/小时

【嘉兴家教 85806410】
联系地址：南湖区格兰上郡
年级性别：初二，女
辅导科目：科学
时间安排：一周1次，一次2小时，周末
教员要求：女，有家教经验
薪资待遇：70元/小时

【嘉兴家教 95296264】
联系地址：海盐县海盐石泉小学附近
年级性别：初二，女
辅导科目：初中全科
时间安排：7次课，每次3-4小时
教员要求：男女皆可，有家教经验
薪资待遇：70-80元/小时

【嘉兴家教 09698189】
联系地址：平湖市龙湖·春江郦城
年级性别：初一，女
辅导科目：数学
时间安排：一周1次，一次2小时 #开学预约单
教员要求：女，有家教经验
薪资待遇：70元/小时

【嘉兴家教 09679735】
联系地址：秀洲区绿城·柳岸禾风公寓2期
年级性别：二年级，男
辅导科目：英语
时间安排：一周2~3次，一次一个小时~1.5个小时
教员要求：男老师，有经验
薪资待遇：60元/小时

【嘉兴家教 21323515】
联系地址：桐乡市革新小区
年级性别：五年级，女
辅导科目：数学,科学
时间安排：一周两次，晚六点到8点，#开学上
教员要求：女老师，理科擅长
薪资待遇：60~70元/小时
#身边有同学想做家教的欢迎多多推荐
群内家教订单可直接转发分享
推荐的朋友接单试课成功，返现金红包`; 
const chloeOrders=vm.runInContext(`splitMessages(${JSON.stringify(chloeBatchSample)}).map(x=>parseOrder(x,'嘉兴家教群201'))`,context);
const chloeSummary=chloeOrders.map(o=>({code:o.orderCode,address:o.address,rate:o.hourlyRate,gender:o.teacherGenderRequirement,postedAt:o.postedAt,raw:o.rawText}));
const expectedChloeCodes=['35942937','85806410','95296264','09698189','09679735','21323515'];
if(chloeOrders.length!==6||chloeSummary.map(o=>o.code).join(',')!==expectedChloeCodes.join(',')||chloeSummary[0].address!=='桐乡市翡翠天御府'||chloeSummary[5].address!=='桐乡市革新小区'||chloeSummary[1].gender!=='female'||chloeSummary[2].gender!=='any'||chloeSummary.some(o=>o.postedAt!=='2026年08月27日 19:14')||chloeSummary[5].raw.includes('现金红包'))throw new Error(`嘉兴家教括号编号批量分割错误：${JSON.stringify(chloeSummary)}`);
console.log('JIAXING_BRACKETED_BATCH_SPLIT_OK');
const multilineSingle=`【嘉兴家教 77778888】
联系地址：南湖区测试小区

辅导科目：数学

学员情况：初二基础一般

时间安排：一周一次
一次2小时

薪资待遇：80元/小时`;
const multilineSingleCount=vm.runInContext(`splitMessages(${JSON.stringify(multilineSingle)}).length`,context);
if(multilineSingleCount!==1)throw new Error(`单个订单被排版换行错误拆分：${multilineSingleCount}`);
console.log('MULTILINE_SINGLE_ORDER_PRESERVED_OK');
const storedMigration=vm.runInContext(`state.orders=[{id:'legacy-merged',source:'嘉兴大学生家教群',rawText:${JSON.stringify(bracketedWechatSample)},createdAt:'2026-08-25T00:00:00.000Z'}];migrateStoredSplitOrders();state.orders.map(o=>({code:o.orderCode,address:o.address,id:o.id}))`,context);
if(storedMigration.length!==2||storedMigration[0].code!=='082135'||storedMigration[1].code!=='0824121'||storedMigration.some(o=>o.address===''))throw new Error(`旧合并订单迁移错误：${JSON.stringify(storedMigration)}`);
console.log('STORED_MERGED_ORDER_MIGRATION_OK');
const priceFragment=vm.runInContext(`({standalone:splitMessages('薪资：75/h 2h').length,merged:splitMessages('初二数学\\n地址：南湖区久久小区\\n\\n薪资：75/h 2h').map(x=>parseOrder(x,'测试群'))})`,context);
if(priceFragment.standalone!==0||priceFragment.merged.length!==1||priceFragment.merged[0].hourlyRate!==75||priceFragment.merged[0].hours!==2)throw new Error(`薪资碎片过滤或回并错误：${JSON.stringify(priceFragment)}`);
const removedStoredFragment=vm.runInContext(`state.orders=[{id:'bad-fragment',source:'测试群',rawText:'薪资：75/h 2h'}];migrateStoredSplitOrders();state.orders.length`,context);
if(removedStoredFragment!==0)throw new Error('已保存的薪资碎片未被自动清理');
console.log('PRICE_ONLY_FRAGMENT_FILTER_OK');
const sessionPriceSample=`A家教张老师【小初高冲刺】
2026年08月25日 14:11
开学后dt26082404
年级：新初二 女
科目：数学 英语
地址：南湖区 久久小区
时间：一周2次 一次4h 160-200每次
要求：有教学经验认真负责`;
const sessionPriceOrder=vm.runInContext(`parseOrder(${JSON.stringify(sessionPriceSample)},'嘉兴大学生家教群')`,context);
if(sessionPriceOrder.orderCode!=='dt26082404'||sessionPriceOrder.hourlyRate!==40||sessionPriceOrder.hourlyRateMax!==50||sessionPriceOrder.totalPrice!==160||sessionPriceOrder.totalPriceMax!==200||sessionPriceOrder.schedule!=='一周2次 一次4h 160-200每次')throw new Error(`每次总价区间换算错误：${JSON.stringify(sessionPriceOrder)}`);
const priceCases=[
  ['一周2次 一次4h 160-200每次',4,40,50],
  ['150元一次，一次2小时',2,75,75],
  ['200元/2小时',2,100,100],
  ['老师课费：60/h',2,60,60]
];
for(const [text,hours,low,high] of priceCases){const price=parser.parseCompensation(text,hours);if(price.hourlyRate!==low||price.hourlyRateMax!==high)throw new Error(`价格格式识别错误：${text} => ${JSON.stringify(price)}`)}
if(parser.parseCompensation('一周2次 一次4h',4).hourlyRate!==null)throw new Error('错误地把上课频次当成单次总价');
console.log('SESSION_PRICE_RANGE_OK');
const hourlyPhraseOrder=vm.runInContext(`parseOrder(${JSON.stringify(`嘉兴家教沈老师（安欣家教）
2026年08月27日 12:59
秀洲区洪合镇#开学后&#x20;
年级：一升二和二升三（都是1对2）
科目：英语
价格：80-100元一个小时
地址：嘉兴秀洲区洪合镇
时间：一周1次，每次 2h &#x20;
要求：英语专业或英语好的优先` )},'嘉兴安欣家教4群')`,context);
if(hourlyPhraseOrder.hours!==2||hourlyPhraseOrder.hourlyRate!==80||hourlyPhraseOrder.hourlyRateMax!==100||hourlyPhraseOrder.weeklyTimes!==1)throw new Error(`“元一个小时”与每次时长识别冲突：${JSON.stringify(hourlyPhraseOrder)}`);
console.log('HOURLY_PHRASE_DURATION_PRIORITY_OK');
const perSessionRangeOrder=vm.runInContext(`parseOrder(${JSON.stringify(`嘉兴家教沈老师（安欣家教）
2026年08月26日 20:00
jxxc-251107007#秀洲三年级
【地址】:秀洲区佳源中心广场附近
【年级性别】： 三年级 男生
【科目】：全科作业辅导+针对性课程安排 英语新三年级，
【学生情况】：基础比较薄弱，需要老师正确引导学习方式
【时间】：周一到周五下午4-7/8点，可以管饭，太晚了家长可以送老师回学校
【要求】：男老师，能管的住孩子的，有方法有带教经验
【价格】：120-180一次`)},'嘉兴安欣家教4群')`,context);
if(perSessionRangeOrder.hours!==3||perSessionRangeOrder.hoursMax!==4||perSessionRangeOrder.hourlyRate!==30||perSessionRangeOrder.hourlyRateMax!==60||perSessionRangeOrder.totalPrice!==120||perSessionRangeOrder.totalPriceMax!==180||perSessionRangeOrder.weeklyTimes!==5)throw new Error(`“下午4-7/8点”与每次总价区间换算错误：${JSON.stringify(perSessionRangeOrder)}`);
const perSessionDerived=vm.runInContext(`derive(${JSON.stringify(perSessionRangeOrder)})`,context);
if(perSessionDerived.income!==120)throw new Error(`每次总价订单的课时收入错误：${JSON.stringify(perSessionDerived)}`);
console.log('SESSION_RANGE_WITH_ALTERNATE_END_OK');
const roundedRoute=vm.runInContext(`roundRouteValues({distanceKm:38.562,driveMinutes:60.166666666666664})`,context);
if(roundedRoute.distanceKm!==38.6||roundedRoute.driveMinutes!==60)throw new Error(`路线数值四舍五入错误：${JSON.stringify(roundedRoute)}`);
console.log('ROUTE_VALUE_ROUNDING_OK');
const zeroFare=vm.runInContext(`derive({grade:'八年级',subject:'数学',address:'测试地址',hourlyRate:80,hours:2,weeklyTimes:1,taxiCost:0,driveMinutes:20})`,context);
if(Number.isFinite(zeroFare.netHourly)||!zeroFare.missing.includes('地图费用异常'))throw new Error('零车费仍被错误计入收益');
console.log('ZERO_FARE_EXCLUDED');
const pendingCount=vm.runInContext(`state.orders=[{id:'ok',taxiCost:30,driveMinutes:20},{id:'zero',taxiCost:0},{id:'empty',taxiCost:null},{id:'demo',demo:true,taxiCost:null}];pendingRouteOrders().length`,context);
if(pendingCount!==2)throw new Error(`待补算筛选错误：${pendingCount}`);
console.log('PENDING_ONLY_FILTERED');
const providerCheck=vm.runInContext(`({defaultProvider:state.settings.mapProvider,baiduName:providerName('baidu'),amapName:providerName('amap'),amapKey:(state.settings={...state.settings,mapProvider:'amap',amapKey:'amap-test-key'},activeMapKey())})`,context);
if(providerCheck.defaultProvider!=='amap'||providerCheck.baiduName!=='百度地图'||providerCheck.amapName!=='高德地图'||providerCheck.amapKey!=='amap-test-key')throw new Error('地图服务商设置兼容性错误');
console.log('MAP_PROVIDER_SETTINGS_OK');
const routeCacheCheck=vm.runInContext(`(()=>{state.settings={...state.settings,travelMode:'taxi',mapProvider:'amap',origin:'嘉兴大学梁林校区',city:'嘉兴市'};const order={id:'cache-test',address:'南湖区测试小区',travelMode:'taxi',travelCost:42,taxiCost:42,distanceKm:12,driveMinutes:36,routeSource:'amap',routeError:null,transitLegs:[]};cacheCurrentRoute(order,'taxi');clearActiveRoute(order,'transit','待计算');order.travelCost=4;order.distanceKm=10;order.driveMinutes=58;order.routeSource='amap';order.routeError=null;cacheCurrentRoute(order,'transit');state.settings.travelMode='taxi';const taxiRestored=restoreCachedRoute(order,'taxi'),taxiCost=order.travelCost,taxiMinutes=order.driveMinutes;state.settings.travelMode='transit';const transitRestored=restoreCachedRoute(order,'transit'),transitCost=order.travelCost;state.settings.city='杭州市';const wrongCityRestored=restoreCachedRoute(order,'transit');return{taxiRestored,taxiCost,taxiMinutes,transitRestored,transitCost,wrongCityRestored,keys:Object.keys(order.routeResults).sort()}})()`,context);
if(!routeCacheCheck.taxiRestored||routeCacheCheck.taxiCost!==42||routeCacheCheck.taxiMinutes!==36||!routeCacheCheck.transitRestored||routeCacheCheck.transitCost!==4||routeCacheCheck.wrongCityRestored||routeCacheCheck.keys.join(',')!=='taxi,transit')throw new Error(`分出行方式路线缓存错误：${JSON.stringify(routeCacheCheck)}`);
console.log('TRAVEL_MODE_ROUTE_CACHE_OK');
const groupAndCopy=vm.runInContext(`state.orders=[{id:'a',source:'群A',rawText:'群A原文',grade:'八年级',subject:'数学',address:'地址A',hourlyRate:80,hourlyRateMax:80,hours:2,hoursMax:2,weeklyTimes:1,weeklyTimesMax:1,taxiCost:20,driveMinutes:30,createdAt:'2026-01-01'},{id:'b',source:'群B',rawText:'群B原文',grade:'九年级',subject:'英语',address:'地址B',hourlyRate:90,hours:2,weeklyTimes:1,taxiCost:30,driveMinutes:40,createdAt:'2026-01-02'}];state.groupFilter='群A';({count:sortedOrders().length,copy:orderCopyText('a')})`,context);
if(groupAndCopy.count!==1||!groupAndCopy.copy.includes('群A原文')||!groupAndCopy.copy.includes('实际净时薪')||groupAndCopy.copy.includes('amap-test-key'))throw new Error('群聊分页或订单复制测试失败');
console.log('GROUP_COPY_OK');

const groupBatchAndImport=vm.runInContext(`state.settings.teacherGender='any';state.groups=['群A','群B'];state.orders=[
  {id:'ready-a',source:'群A',rawText:'学员地址：地址A',address:'地址A',addressAmbiguous:false,requiresEmployedTeacher:false,teacherGenderRequirement:'any'},
  {id:'pass-a',source:'群A',rawText:'教员要求：专职老师',address:'地址B',addressAmbiguous:false,requiresEmployedTeacher:true,teacherGenderRequirement:'any'},
  {id:'ambiguous-a',source:'群A',rawText:'学员地址：图书馆',address:'图书馆',addressAmbiguous:true,requiresEmployedTeacher:false,teacherGenderRequirement:'any'},
  {id:'ready-b',source:'群B',rawText:'学员地址：地址C',address:'地址C',addressAmbiguous:false,requiresEmployedTeacher:false,teacherGenderRequirement:'any'}
];state.groupFilter='群A';els.importGroupSelect.value='群A';const existing=selectedImportSource();els.importGroupSelect.value='__new__';document.querySelector('#source-group').value='新群';({candidateIds:groupRouteCandidates().map(o=>o.id),existing,newGroup:selectedImportSource()})`,context);
if(groupBatchAndImport.candidateIds.join(',')!=='ready-a'||groupBatchAndImport.existing!=='群A'||groupBatchAndImport.newGroup!=='新群')throw new Error(`群聊重算或导入目标选择错误：${JSON.stringify(groupBatchAndImport)}`);
console.log('GROUP_RECALCULATE_AND_IMPORT_TARGET_OK');
const groupClearOnly=vm.runInContext(`deleteSelectedGroup();els.deleteGroupToo.checked=false;confirmDeleteSelectedGroup();({remaining:state.orders.map(o=>o.id),groups:[...state.groups],groupFilter:state.groupFilter})`,context);
if(groupClearOnly.remaining.some(id=>['ready-a','pass-a','ambiguous-a'].includes(id))||!groupClearOnly.remaining.includes('ready-b')||!groupClearOnly.groups.includes('群A')||groupClearOnly.groupFilter!=='群A')throw new Error(`仅清空群订单错误：${JSON.stringify(groupClearOnly)}`);
const groupDelete=vm.runInContext(`deleteSelectedGroup();els.deleteGroupToo.checked=true;confirmDeleteSelectedGroup();({groups:[...state.groups],groupFilter:state.groupFilter})`,context);
if(groupDelete.groups.includes('群A')||!groupDelete.groups.includes('群B')||groupDelete.groupFilter!=='all')throw new Error(`同时删除群聊错误：${JSON.stringify(groupDelete)}`);
console.log('SELECTED_GROUP_DELETE_OK');

const genderCases=[
  ['学员情况：五年级男生\n教员要求：男女不限','any'],
  ['教员要求：女老师，有经验','female'],
  ['教员要求：要女生，过六级','female'],
  ['教员要求：男老师，认真负责','male']
];
for(const [text,expected] of genderCases){const actual=parser.parseTeacherGenderRequirement(text);if(actual!==expected)throw new Error(`教员性别识别错误：${text} => ${actual}`)}
for(const text of ['教员要求：要求在职老师，有经验','教员要求：专职老师','教员要求：专职的老师','老师要求：全职教师','教员要求：在编教师','教员要求：有教师编制','教员要求：一线老师','教员要求：学校教师优先','教员要求：机构老师','教员要求：退休教师','教员要求：专职家教','要求：专职/独立老师'])if(!parser.requiresEmployedTeacher(text))throw new Error(`未识别职业老师要求：${text}`);
if(!parser.requiresEmployedTeacher('嘉兴#开学后#专职老师'))throw new Error('未识别井号后明确写出的专职老师身份');
for(const text of ['嘉兴#开学后#专职','嘉兴#在职','嘉兴＃全职','嘉兴#在编'])if(!parser.requiresEmployedTeacher(text))throw new Error(`未识别明确职业井号标签：${text}`);
for(const text of ['嘉兴#开学后#长期','嘉兴#英语好','嘉兴#男老师'])if(parser.requiresEmployedTeacher(text))throw new Error(`错误地把普通井号标签判定为职业老师要求：${text}`);
for(const text of ['教员要求：不要求在职老师','教员要求：无需专职老师','教员要求：有教师资格证','教员要求：有教学经验'])if(parser.requiresEmployedTeacher(text))throw new Error(`误识别职业老师要求：${text}`);
console.log('TEACHER_REQUIREMENT_PARSER_OK');

for(const text of ['报销路费','报销车费','补贴车费','补贴路费','提供往返车补','路费实报实销'])if(!parser.hasTransportReimbursement(text))throw new Error(`未识别路费报销：${text}`);
for(const text of ['不报销路费','没有补贴车费'])if(parser.hasTransportReimbursement(text))throw new Error(`误识别否定路费说明：${text}`);
const covered=vm.runInContext(`derive({rawText:'补贴路费',transportCovered:true,hourlyRate:80,hours:2,weeklyTimes:1,taxiCost:0,driveMinutes:30})`,context);
if(covered.cashNet!==160||!Number.isFinite(covered.netHourly)||covered.missing.includes('地图费用异常')||covered.ratio!==Infinity)throw new Error('路费报销收益计算错误');
console.log('TRANSPORT_REIMBURSEMENT_OK');

const passFiltering=vm.runInContext(`state.settings.teacherGender='male';state.groupFilter='all';state.search='';state.orders=[
  {id:'any',rawText:'教员要求：男女不限',teacherGenderRequirement:'any',requiresEmployedTeacher:false,taxiCost:null},
  {id:'female',rawText:'教员要求：女老师',teacherGenderRequirement:'female',requiresEmployedTeacher:false,taxiCost:null},
  {id:'employed',rawText:'教员要求：在职老师',teacherGenderRequirement:'any',requiresEmployedTeacher:true,taxiCost:null}
];state.filter='all';const active=sortedOrders().map(o=>o.id);state.filter='passed';const passed=sortedOrders().map(o=>o.id);({active,passed,pending:pendingRouteOrders().map(o=>o.id)})`,context);
if(passFiltering.active.join(',')!=='any'||passFiltering.passed.sort().join(',')!=='employed,female'||passFiltering.pending.join(',')!=='any')throw new Error(`PASS 筛选或地图跳过错误：${JSON.stringify(passFiltering)}`);
console.log('PASS_FILTER_AND_MAP_SKIP_OK');
const cityAndDistance=vm.runInContext(`state.settings.city='嘉兴市';state.settings.maxOneWayKm=20;state.settings.teacherGender='any';({prefixed:mapQueryAddress('南湖区大朱楼'),unchanged:mapQueryAddress('嘉兴市秀洲区洪合镇'),far:passReason({rawText:'',distanceKm:42,teacherGenderRequirement:'any',requiresEmployedTeacher:false}),near:passReason({rawText:'',distanceKm:40,teacherGenderRequirement:'any',requiresEmployedTeacher:false})})`,context);
if(cityAndDistance.prefixed!=='嘉兴市南湖区大朱楼'||cityAndDistance.unchanged!=='嘉兴市秀洲区洪合镇'||!cityAndDistance.far.includes('超过 20 km')||cityAndDistance.near!=='')throw new Error(`城市前缀或距离阈值错误：${JSON.stringify(cityAndDistance)}`);
console.log('CITY_PREFIX_AND_DISTANCE_LIMIT_OK');

const favoriteBehavior=vm.runInContext(`state.settings.teacherGender='any';state.groupFilter='all';state.filter='all';state.groups=['收藏测试群'];state.favorites=[];state.orders=[{id:'favorite-a',source:'收藏测试群',rawText:'初二数学\\n学员地址：久久小区\\n老师课费：80/h',grade:'初二',subject:'数学',address:'久久小区',hourlyRate:80,hours:2,weeklyTimes:1,taxiCost:30,distanceKm:12,driveMinutes:35,createdAt:'2026-08-26T00:00:00.000Z'}];toggleFavorite('favorite-a');const storedBefore=JSON.parse(localStorage.getItem(STORAGE_FAVORITES));state.orders=[];save();state.filter='favorites';({favoriteCount:state.favorites.length,storedCount:storedBefore.length,listIds:sortedOrders().map(o=>o.id),copy:orderCopyText('favorite-a')})`,context);
if(favoriteBehavior.favoriteCount!==1||favoriteBehavior.storedCount!==1||favoriteBehavior.listIds.join(',')!=='favorite-a'||!favoriteBehavior.copy.includes('初二数学')||!favoriteBehavior.copy.includes('实际净时薪'))throw new Error(`收藏快照独立保存错误：${JSON.stringify(favoriteBehavior)}`);
console.log('FAVORITE_SNAPSHOT_AND_COPY_OK');

const clearAllProtected=vm.runInContext(`state.orders=[{id:'clear-a',source:'保留群',rawText:'待删除订单'}];state.groups=['保留群'];state.favorites=[{id:'favorite-keep',source:'保留群',rawText:'保留收藏',favoritedAt:'2026-08-26T00:00:00.000Z'}];state.filter='all';state.groupFilter='保留群';openClearAll();const defaultsUnchecked=!els.clearAllGroups.checked&&!els.clearAllFavorites.checked;confirmClearAll();({defaultsUnchecked,orders:state.orders.length,groups:[...state.groups],favorites:state.favorites.map(o=>o.id),groupFilter:state.groupFilter})`,context);
if(!clearAllProtected.defaultsUnchecked||clearAllProtected.orders!==0||clearAllProtected.groups.join(',')!=='保留群'||clearAllProtected.favorites.join(',')!=='favorite-keep'||clearAllProtected.groupFilter!=='保留群')throw new Error(`全局清空默认保护错误：${JSON.stringify(clearAllProtected)}`);

const clearAllOptional=vm.runInContext(`state.orders=[{id:'clear-b',source:'待删群',rawText:'待删除订单'}];state.groups=['待删群'];state.favorites=[{id:'favorite-delete',source:'待删群',rawText:'待删除收藏'}];state.filter='favorites';state.groupFilter='待删群';openClearAll();els.clearAllGroups.checked=true;els.clearAllFavorites.checked=true;confirmClearAll();({orders:state.orders.length,groups:state.groups.length,favorites:state.favorites.length,filter:state.filter,groupFilter:state.groupFilter})`,context);
if(clearAllOptional.orders!==0||clearAllOptional.groups!==0||clearAllOptional.favorites!==0||clearAllOptional.filter!=='all'||clearAllOptional.groupFilter!=='all')throw new Error(`全局清空可选内容错误：${JSON.stringify(clearAllOptional)}`);
console.log('CLEAR_ALL_SECONDARY_OPTIONS_OK');

const senderTimestampSample=`kk
2026年08月26日 13:35
xc081801l长期单
内容：初二升初三女生，主要英语辅导，讲语法，文科都能带一带

要求：认真负责有经验，女老师，耐心一些，英语专业，高考分数125\\~130分及以上

薪资：90/h 2h/3h

时间：长期单，暑期三次左右，开学后周末辅导（刚开始两个小时，后续文科都能带会改三个小时）
&#x20;
地点：嘉兴市南湖区万科泊樾湾

kk
2026年08月26日 13:35
xc082104l开学后辅导
内容：新6年级男生，英语辅导，基础比较差，主要巩固，辅导单词，语法

要求：认真负责有经验，女老师，耐心一些，温柔一点，暑期能试几次课

薪资：60/h 2h

时间：长期单，暑期试几次课，开学后辅导，一周两到三次
&#x20;
地点：嘉兴市秀洲区金地艺境

kk
2026年08月26日 13:35
xc071001（王）
内容：初二升初三女孩，科学辅导，四五十分

要求：认真负责有经验女老师，要求试课，要求看简历，能长期辅导

薪资：90/h 2h

时间：长期单，暑期连着上半个月（具体上课时间要看孩子什么时候放假），开学后一星期一节课，
&#x20;
地点:嘉兴市王江泾锦绣江南`;
const senderTimestampOrders=vm.runInContext(`splitMessages(${JSON.stringify(senderTimestampSample)}).map(block=>parseOrder(block,'换行测试群')).map(order=>({code:order.orderCode,address:order.address,subject:order.subject,rate:order.hourlyRate,hours:order.hours,weekly:[order.weeklyTimes,order.weeklyTimesMax],gender:order.teacherGenderRequirement,postedAt:order.postedAt,rawText:order.rawText}))`,context);
if(senderTimestampOrders.length!==3||senderTimestampOrders.map(o=>o.code).join(',')!=='xc081801l,xc082104l,xc071001'||senderTimestampOrders.map(o=>o.address).join(',')!=='嘉兴市南湖区万科泊樾湾,嘉兴市秀洲区金地艺境,嘉兴市王江泾锦绣江南'||senderTimestampOrders.some(o=>o.gender!=='female'||o.postedAt!=='2026年08月26日 13:35'||!o.rawText.includes('时间：长期单'))||senderTimestampOrders[1].weekly[0]!==2||senderTimestampOrders[1].weekly[1]!==3)throw new Error(`发送人+时间分单错误：${JSON.stringify(senderTimestampOrders)}`);
console.log('SENDER_TIMESTAMP_SPLIT_OK');

const mixedSendersSample=`张老师【初中家教】
2026/8/26 14:01
xc26082601
内容：新初一数学

薪资：80/h 2h
地点：嘉兴市南湖区巴黎都市

家教发布员-小王
8月26日 星期三 14:03
xc26082602
内容：新初二英语

薪资：90/h 2h
地点：嘉兴市秀洲区金都佳苑

🌙群助手
昨天 14:05
xc26082603
内容：六年级科学

薪资：70/h 2h
地点：嘉兴市海宁市长安镇`;
const mixedSenders=vm.runInContext(`splitMessages(${JSON.stringify(mixedSendersSample)}).map(block=>parseOrder(block,'多发单人群')).map(order=>({code:order.orderCode,address:order.address,postedAt:order.postedAt}))`,context);
if(mixedSenders.length!==3||mixedSenders.map(o=>o.code).join(',')!=='xc26082601,xc26082602,xc26082603'||mixedSenders.map(o=>o.postedAt).join('|')!=='2026/8/26 14:01|8月26日 星期三 14:03|昨天 14:05')throw new Error(`多发单人与时间格式分单错误：${JSON.stringify(mixedSenders)}`);
console.log('MIXED_SENDERS_AND_TIME_FORMATS_OK');

const compactMultiOrderSample=`家教发单员
2026年08月27日 10:15
🚩JXOT2666082601#秀洲中学
【地址】：嘉兴市秀洲区油车港
【科目】：小学数学
【时间】：一周两次
【价格】：55/h1.5h

🔴JXQT2666082502#南湖中学
【地址】：嘉兴市南湖区庆丰路
【科目】：初二英语
【时间】：一周一次
【价格】：90/h2h`;
const compactMultiOrders=vm.runInContext(`splitMessages(${JSON.stringify(compactMultiOrderSample)}).map(block=>parseOrder(block,'同气泡多单群')).map(order=>({code:order.orderCode,address:order.address,subject:order.subject,rate:order.hourlyRate,hours:order.hours,postedAt:order.postedAt,rawText:order.rawText}))`,context);
if(compactMultiOrders.length!==2||compactMultiOrders.map(o=>o.code).join(',')!=='JXOT2666082601,JXQT2666082502'||compactMultiOrders.map(o=>o.rate).join(',')!=='55,90'||compactMultiOrders.map(o=>o.hours).join(',')!=='1.5,2'||compactMultiOrders.some(o=>o.postedAt!=='2026年08月27日 10:15'||!o.rawText.startsWith('家教发单员\n2026年08月27日 10:15'))||compactMultiOrders[0].rawText.includes('JXQT2666082502'))throw new Error(`JX订单号、表情前缀、同气泡分单或紧凑薪资错误：${JSON.stringify(compactMultiOrders)}`);
console.log('JX_MULTI_ORDER_AND_COMPACT_RATE_OK');

const genericNumericSample=`另一位发单人
2026年08月27日 10:20
● 8394710265841
地址：嘉兴市南湖区测试小区A
科目：数学
价格：70/h2h

• 9471203658427
地址：嘉兴市秀洲区测试小区B
科目：英语
价格：80/h1.5h`;
const genericNumericOrders=vm.runInContext(`splitMessages(${JSON.stringify(genericNumericSample)}).map(block=>parseOrder(block,'长数字订单群')).map(order=>({code:order.orderCode,address:order.address,rate:order.hourlyRate,hours:order.hours,postedAt:order.postedAt}))`,context);
if(genericNumericOrders.length!==2||genericNumericOrders.map(o=>o.code).join(',')!=='8394710265841,9471203658427'||genericNumericOrders.map(o=>o.rate).join(',')!=='70,80'||genericNumericOrders.map(o=>o.hours).join(',')!=='2,1.5'||genericNumericOrders.some(o=>o.postedAt!=='2026年08月27日 10:20'))throw new Error(`通用长数字订单号分割错误：${JSON.stringify(genericNumericOrders)}`);
const phoneGuard=vm.runInContext(`splitMessages('发单人\\n2026年08月27日 10:30\\nxc27082701\\n内容：初一数学\\n13800138000\\n地址：嘉兴市南湖区测试地址\\n薪资：80/h2h').length`,context);
if(phoneGuard!==1)throw new Error(`手机号被误识别为订单分割点：${phoneGuard}`);
console.log('GENERIC_NUMERIC_SPLIT_AND_PHONE_GUARD_OK');

const travelModeBehavior=vm.runInContext(`state.settings={...state.settings,mapProvider:'baidu',travelMode:'transit',amapKey:'amap-test-key',ak:'baidu-test-key'};state.orders=[{id:'transit-a',source:'出行测试群',rawText:'初二数学',grade:'初二',subject:'数学',address:'测试地址',hourlyRate:100,hours:2,weeklyTimes:1,travelMode:'transit',travelCost:8,distanceKm:12,driveMinutes:80,transitTransfersOneWay:1,transitLegs:[{line:'1路(起点--终点)',departureStop:'甲站',arrivalStop:'乙站'},{line:'2路(起点--终点)',departureStop:'乙站',arrivalStop:'丙站'}]}];const transit=derive(state.orders[0]);const free=derive({grade:'初二',subject:'数学',address:'测试地址',hourlyRate:100,hours:2,weeklyTimes:1,travelMode:'free',travelCost:0,distanceKm:12,driveMinutes:40});({provider:routeProvider(),key:activeRouteKey(),transitCost:transit.travelCost,transitCash:transit.cashNet,transitCopy:orderCopyText('transit-a'),freeCash:free.cashNet,freeRatio:free.ratio,freeComplete:(state.settings.travelMode='free',routeComplete(free)),modeLabels:['taxi','transit','ebike','bicycle','free'].map(travelModeLabel)})`,context);
if(travelModeBehavior.provider!=='amap'||travelModeBehavior.key!=='amap-test-key'||travelModeBehavior.transitCost!==8||travelModeBehavior.transitCash!==192||!travelModeBehavior.transitCopy.includes('出行方式：公交车')||!travelModeBehavior.transitCopy.includes('甲站→乙站')||travelModeBehavior.freeCash!==200||travelModeBehavior.freeRatio!==Infinity||!travelModeBehavior.freeComplete||travelModeBehavior.modeLabels.join(',')!=='打车,公交车,共享电单车,自行车,自由出行')throw new Error(`多出行方式收益或文案错误：${JSON.stringify(travelModeBehavior)}`);
console.log('MULTI_TRAVEL_MODE_DERIVE_OK');
