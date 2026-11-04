-- Groups that followed one league now also follow the top four leagues and Europe (see leaguePack in lib/locale.ts).
UPDATE groups SET leagues='[203,39,140,135,78,2,3,848]' WHERE leagues='[203]';
UPDATE groups SET leagues='[39,140,135,78,2,3,848]' WHERE leagues='[39]';
UPDATE groups SET leagues='[140,39,135,78,2,3,848]' WHERE leagues='[140]';
UPDATE groups SET leagues='[135,39,140,78,2,3,848]' WHERE leagues='[135]';
UPDATE groups SET leagues='[78,39,140,135,2,3,848]' WHERE leagues='[78]';
UPDATE groups SET leagues='[61,39,140,135,78,2,3,848]' WHERE leagues='[61]';
UPDATE groups SET leagues='[71,39,140,135,78,2,3,848]' WHERE leagues='[71]';
UPDATE groups SET leagues='[253,39,140,135,78,2,3,848]' WHERE leagues='[253]';
