alter table puzzle_attempts drop constraint if exists puzzle_attempts_position_check;
alter table puzzle_attempts add constraint puzzle_attempts_position_check check (position between 1 and 6);

alter table puzzle_attempts drop constraint if exists puzzle_attempts_duration_ms_check;
alter table puzzle_attempts add constraint puzzle_attempts_duration_ms_check check (duration_ms >= 0);
