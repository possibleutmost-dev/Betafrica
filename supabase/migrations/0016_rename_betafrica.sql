-- The site is BetAfrica now. Same two places the name reaches the database as
-- in 0012 and 0013: the house league custom matches are filed under, and the
-- account name shown on the manual deposit screen.
--
-- The updates match on every prior name, so a deployment at any earlier step
-- lands on the same rows.

alter table custom_matches alter column league set default 'BetAfrica Special';

update custom_matches
   set league = 'BetAfrica Special'
 where league in ('3btafric Special', 'Stakeza Special', 'Betlixx Special', 'WinnBet Special');

update app_settings
   set value = 'BetAfrica Ghana', updated_at = now()
 where key = 'deposit_account_name'
   and value in ('3btafric Ghana', 'Stakeza Ghana', 'Betlixx Ghana', 'WinnBet Ghana');
