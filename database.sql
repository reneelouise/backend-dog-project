CREATE TABLE pastes (
    paste_id serial primary key,
    author text,
  	title text,
    paste text not null
    );

CREATE TABLE comments (
	comment_id SERIAL PRIMARY KEY,
  	paste_id INTEGER,
  	comment TEXT,
  	CONSTRAINT fk_paste FOREIGN KEY (paste_id) REFERENCES pastes (paste_id)
);
