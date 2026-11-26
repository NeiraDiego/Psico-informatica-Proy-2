alter table puzzle_attempts drop constraint if exists puzzle_attempts_position_check;
alter table puzzle_attempts add constraint puzzle_attempts_position_check check (position between 1 and 7);
