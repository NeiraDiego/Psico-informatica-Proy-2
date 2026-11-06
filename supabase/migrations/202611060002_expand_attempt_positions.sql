alter table puzzle_attempts drop constraint if exists puzzle_attempts_position_check;
alter table puzzle_attempts add constraint puzzle_attempts_position_check check (position between 1 and 5);

alter table sessions drop constraint if exists sessions_group_check;
alter table sessions add constraint sessions_group_check check ("group" in ('A', 'B', 'C', 'D'));

alter table sessions add column if not exists participant_name text;
