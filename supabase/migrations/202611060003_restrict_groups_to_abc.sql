alter table sessions drop constraint if exists sessions_group_check;
alter table sessions add constraint sessions_group_check check ("group" in ('A', 'B', 'C'));
