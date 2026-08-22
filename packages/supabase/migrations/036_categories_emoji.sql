alter table categories add column emoji text;

-- Seed emojis for default categories
update categories set emoji = '🎵' where name = 'Music'       and type = 'like';
update categories set emoji = '⚽' where name = 'Sports'      and type = 'like';
update categories set emoji = '🎨' where name = 'Art'         and type = 'like';
update categories set emoji = '🍳' where name = 'Cooking'     and type = 'like';
update categories set emoji = '🎬' where name = 'Movies'      and type = 'like';
update categories set emoji = '📚' where name = 'Reading'     and type = 'like';
update categories set emoji = '💃' where name = 'Dancing'     and type = 'like';
update categories set emoji = '🎮' where name = 'Gaming'      and type = 'like';
update categories set emoji = '🐾' where name = 'Animals'     and type = 'like';
update categories set emoji = '🌿' where name = 'Nature'      and type = 'like';
update categories set emoji = '🏊' where name = 'Swimming'    and type = 'like';

update categories set emoji = '🔊' where name = 'Loud noises' and type = 'dislike';
update categories set emoji = '👥' where name = 'Crowds'      and type = 'dislike';
update categories set emoji = '🌶️' where name = 'Spicy food'  and type = 'dislike';

update categories set emoji = '💪' where name = 'Lift a table'      and type = 'ability';
update categories set emoji = '🔢' where name = 'Do basic maths'    and type = 'ability';
update categories set emoji = '⚽' where name = 'Kick a ball'       and type = 'ability';
update categories set emoji = '📖' where name = 'Read simple words' and type = 'ability';
update categories set emoji = '✏️' where name = 'Draw shapes'       and type = 'ability';
update categories set emoji = '💯' where name = 'Count to 100'      and type = 'ability';
update categories set emoji = '🚲' where name = 'Ride a bicycle'    and type = 'ability';
update categories set emoji = '🍳' where name = 'Cook simple meals' and type = 'ability';
