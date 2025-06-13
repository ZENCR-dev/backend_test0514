-- 专业中药描述更新脚本
-- 生成时间: 2025-06-13T03:05:29.962Z
-- 包含 21 种中药的专业描述

-- 创建备份表
CREATE TABLE IF NOT EXISTS medicines_backup_professional_descriptions AS 
SELECT * FROM medicines;

-- 更新专业描述
UPDATE medicines SET description = '甘、辛，温。归肝、心、脾经。补血调经，润燥滑肠，活血止痛。用于血虚萎黄，眩晕心悸，月经不调，经闭痛经，虚寒腹痛，肠燥便秘，风湿痹痛，跌扑损伤，痈疽疮疡。' WHERE chinese_name = '当归';
UPDATE medicines SET description = '甘，微温。归脾、肺经。补气固表，利尿托毒，排脓，敛疮生肌。用于气虚乏力，食少便溏，中气下陷，久泻脱肛，便血崩漏，表虚自汗，气虚水肿，痈疽难溃，久溃不敛，血虚痿黄，内热消渴。' WHERE chinese_name = '黄芪';
UPDATE medicines SET description = '甘、微苦，微温。归脾、肺、心、肾经。大补元气，复脉固脱，补脾益肺，生津养血，安神益智。用于体虚欲脱，肢冷脉微，脾虚食少，肺虚喘咳，津伤口渴，内热消渴，气血亏虚，久病虚羸，惊悸失眠，阳痿宫冷。' WHERE chinese_name = '人参';
UPDATE medicines SET description = '甘，平。归心、肺、脾、胃经。补脾益气，清热解毒，祛痰止咳，缓急止痛，调和诸药。用于脾胃虚弱，倦怠乏力，心悸气短，咳嗽痰多，脘腹、四肢挛急疼痛，痈肿疮毒，缓解药物毒性、烈性。' WHERE chinese_name = '甘草';
UPDATE medicines SET description = '甘、淡，平。归心、肺、脾、肾经。利水渗湿，健脾，宁心。用于水肿尿少，痰饮眩悸，脾虚食少，便溏泄泻，心神不安，惊悸失眠。' WHERE chinese_name = '茯苓';
UPDATE medicines SET description = '苦、甘，温。归脾、胃经。健脾益气，燥湿利水，止汗，安胎。用于脾虚食少，腹胀泄泻，痰饮眩悸，水肿，自汗，胎动不安。' WHERE chinese_name = '白术';
UPDATE medicines SET description = '辛，温。归肝、胆、心包经。活血行气，祛风止痛。用于胸痹心痛，胸胁刺痛，跌扑肿痛，月经不调，经闭痛经，产后瘀阻，头痛，风湿痹痛。' WHERE chinese_name = '川芎';
UPDATE medicines SET description = '苦、酸，微寒。归肝、脾经。养血调经，敛阴止汗，柔肝止痛，平抑肝阳。用于血虚萎黄，月经不调，自汗，盗汗，胁痛，腹痛，四肢挛痛，头痛眩晕。' WHERE chinese_name = '白芍';
UPDATE medicines SET description = '甘，微温。归肝、肾经。滋阴补血，益精填髓。用于血虚萎黄，心悸怔忡，月经不调，崩漏下血，肝肾阴虚，腰膝酸软，骨蒸潮热，盗汗遗精，内热消渴，血虚便秘，肾虚喘促。' WHERE chinese_name = '熟地黄';
UPDATE medicines SET description = '甘，寒。归心、肝、肾经。清热凉血，养阴，生津。用于热病舌绛烦渴，阴虚内热，骨蒸劳热，内热消渴，吐血，衄血，发斑发疹。' WHERE chinese_name = '生地黄';
UPDATE medicines SET description = '苦、甘、涩，微温。归肝、心、肾经。解毒，消痈，截疟，润肠通便。用于疮痈，瘰疬，风疹瘙痒，久疟体虚，肠燥便秘。' WHERE chinese_name = '何首乌';
UPDATE medicines SET description = '甘，平。归肝、肾经。滋补肝肾，益精明目。用于虚劳精亏，腰膝酸痛，眩晕耳鸣，阳痿遗精，内热消渴，血虚萎黄，目昏不明。' WHERE chinese_name = '枸杞子';
UPDATE medicines SET description = '甘、苦，微寒。归肺、肝经。散风清热，平肝明目，清热解毒。用于风热感冒，头痛眩晕，目赤肿痛，眼目昏花，疮痈肿毒。' WHERE chinese_name = '菊花';
UPDATE medicines SET description = '甘，寒。归肺、心、胃经。清热解毒，疏散风热。用于痈肿疔疮，喉痹，丹毒，热毒血痢，风热感冒，温病发热。' WHERE chinese_name = '金银花';
UPDATE medicines SET description = '苦，微寒。归肺、心、小肠经。清热解毒，消肿散结，疏散风热。用于痈疽，瘰疬，乳痈，丹毒，风热感冒，温病初起，温热入营，高热烦渴，神昏发斑，热淋尿闭。' WHERE chinese_name = '连翘';
UPDATE medicines SET description = '苦，寒。归心、胃经。清热解毒，凉血利咽。用于温疫时毒，发热咽痛，温毒发斑，痄腮，烂喉丹痧，大头瘟疫，丹毒，痈肿。' WHERE chinese_name = '板蓝根';
UPDATE medicines SET description = '苦，寒。归心、脾、胃、肝、胆、大肠经。清热燥湿，泻火解毒。用于湿热痞满，呕吐吞酸，泻痢，黄疸，高热神昏，心火亢盛，心烦不寐，血热吐衄，目赤，牙痛，消渴，痈肿疔疮；外治湿疹，湿疮，耳道流脓。' WHERE chinese_name = '黄连';
UPDATE medicines SET description = '苦，寒。归肺、胆、脾、大肠、小肠经。清热燥湿，泻火解毒，止血，安胎。用于湿温、暑湿，胸闷呕恶，湿热痞满，泻痢，黄疸，肺热咳嗽，高热烦渴，血热吐衄，痈肿疔疮，胎动不安。' WHERE chinese_name = '黄芩';
UPDATE medicines SET description = '苦，寒。归肾、膀胱、大肠经。清热燥湿，泻火除蒸，解毒疗疮。用于湿热泻痢，黄疸，带下，热淋，脚气，痿蹙，骨蒸劳热，盗汗，遗精，疮疡肿毒，湿疹瘙痒。' WHERE chinese_name = '黄柏';
UPDATE medicines SET description = '苦，寒。归心、肝、肺、胃、三焦经。泻火除烦，清热利湿，凉血解毒；外用消肿止痛。用于热病心烦，湿热黄疸，淋证涩痛，血热吐衄，目赤肿痛，火毒疮疡；外治扭挫伤痛。' WHERE chinese_name = '栀子';
UPDATE medicines SET description = '苦，寒。归肝、胆经。清热燥湿，泻肝胆火。用于湿热黄疸，阴肿阴痒，带下，强中，湿疹瘙痒，目赤，耳聋，胁痛，口苦，惊风抽搐。' WHERE chinese_name = '龙胆草';

-- 验证更新结果
SELECT 
  chinese_name,
  CASE 
    WHEN LENGTH(description) > 50 THEN '专业描述'
    ELSE '简单描述'
  END as description_type,
  LENGTH(description) as description_length
FROM medicines 
WHERE chinese_name IN ('当归', '黄芪', '人参', '甘草', '茯苓', '白术', '川芎', '白芍', '熟地黄', '生地黄', '何首乌', '枸杞子', '菊花', '金银花', '连翘', '板蓝根', '黄连', '黄芩', '黄柏', '栀子', '龙胆草')
ORDER BY chinese_name;
