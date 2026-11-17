-- 清理 P5「季度经营报表」演示应用的 MySQL demo 数据（4 行）
--
-- 背景：P5 验证真实 MySQL 非空界面时，向以下两张表各插入 2 行 demo 数据，
--       ID 含 `-demo-`（应用目录与工作台登记已在 R4b-2 删除）。
-- 表/列名来自应用 DAO（backend/.../ReportingJdbcDao.java）：
--   quarterly_reporting_date(id, `year`, quarter)
--   quarterly_reporting_business_atm(id, dateId, ...)
--
-- 使用方式：
--   1. 连接到正确的数据库（演示应用所用 schema），先执行「1) 预览」；
--   2. 确认只命中 `-demo-` 行后，再执行「2) 删除」；
--   3. 删除先 ATM 后 date（ATM 通过 dateId 关联季度）。
-- 风险：会永久删除数据；执行前请自行备份。

-- 1) 预览（先执行这一段）
SELECT 'quarterly_reporting_date' AS table_name, `id`, `year`, `quarter`
FROM `quarterly_reporting_date`
WHERE `id` LIKE '%-demo-%';

SELECT 'quarterly_reporting_business_atm' AS table_name, `id`, `dateId`
FROM `quarterly_reporting_business_atm`
WHERE `id` LIKE '%-demo-%';

-- 2) 删除（预览确认后执行；先 ATM 后 date）
START TRANSACTION;

DELETE FROM `quarterly_reporting_business_atm`
WHERE `id` LIKE '%-demo-%';

DELETE FROM `quarterly_reporting_date`
WHERE `id` LIKE '%-demo-%';

-- 确认影响行数无误后再提交；如不确定，执行 ROLLBACK;
COMMIT;
