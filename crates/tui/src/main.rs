use crossterm::{
    event::{self, Event, KeyCode, KeyEventKind},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use game_core::*;
use ratatui::{
    backend::CrosstermBackend,
    layout::{Alignment, Constraint, Layout},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph},
    Frame, Terminal,
};
use std::io;

struct App {
    engine: Engine,
    game_id: Option<GameId>,
    status: String,
}

impl App {
    fn new() -> Self {
        let mut engine = Engine::new();
        let state = engine.create_game(&GameConfig::default()).unwrap();
        let game_id = Some(state.game.id);
        Self {
            engine,
            game_id,
            status: String::new(),
        }
    }

    fn make_move(&mut self, dir: Direction) {
        let Some(id) = self.game_id else {
            return;
        };
        match self.engine.make_move(id, dir) {
            Ok(state) => {
                if state.game.is_terminated {
                    self.status = "Game Over!".to_string();
                } else {
                    self.status.clear();
                }
            }
            Err(e) => {
                self.status = e;
            }
        }
    }

    fn new_game(&mut self) {
        match self.engine.create_game(&GameConfig::default()) {
            Ok(state) => {
                self.game_id = Some(state.game.id);
                self.status.clear();
            }
            Err(e) => {
                self.status = e;
            }
        }
    }

    fn current_state(&self) -> Option<GameState> {
        let id = self.game_id?;
        self.engine.get_state(id).ok()
    }
}

fn main() -> Result<(), io::Error> {
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let mut app = App::new();

    loop {
        terminal.draw(|f| ui(f, &app))?;

        if let Event::Key(key) = event::read()? {
            if key.kind != KeyEventKind::Press {
                continue;
            }
            match key.code {
                KeyCode::Char('q') | KeyCode::Esc => break,
                KeyCode::Char('r') => app.new_game(),
                KeyCode::Up | KeyCode::Char('w') => app.make_move(Direction::Up),
                KeyCode::Down | KeyCode::Char('s') => app.make_move(Direction::Down),
                KeyCode::Left | KeyCode::Char('a') => app.make_move(Direction::Left),
                KeyCode::Right | KeyCode::Char('d') => app.make_move(Direction::Right),
                _ => {}
            }
        }
    }

    disable_raw_mode()?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen)?;
    terminal.show_cursor()?;
    Ok(())
}

fn ui(f: &mut Frame, app: &App) {
    let chunks = Layout::default()
        .direction(ratatui::layout::Direction::Vertical)
        .constraints([
            Constraint::Length(3),
            Constraint::Min(10),
            Constraint::Length(3),
        ])
        .split(f.area());

    // Header
    let header = Paragraph::new("2048 — Arrow keys/WASD to move, R to restart, Q to quit")
        .style(Style::default().fg(Color::Cyan))
        .alignment(Alignment::Center)
        .block(Block::default().borders(Borders::ALL));
    f.render_widget(header, chunks[0]);

    // Board
    if let Some(state) = app.current_state() {
        let board = render_board(&state.active_board);
        let score_line = Line::from(vec![
            Span::styled(
                "Score: ",
                Style::default().fg(Color::Yellow),
            ),
            Span::styled(
                state.game.score.to_string(),
                Style::default()
                    .fg(Color::Yellow)
                    .add_modifier(Modifier::BOLD),
            ),
        ]);
        let board_widget = Paragraph::new(board)
            .alignment(Alignment::Center)
            .block(
                Block::default()
                    .title(score_line)
                    .borders(Borders::ALL)
                    .style(Style::default().fg(Color::White)),
            );
        f.render_widget(board_widget, chunks[1]);
    } else {
        let empty = Paragraph::new("No game active")
            .alignment(Alignment::Center)
            .block(Block::default().borders(Borders::ALL));
        f.render_widget(empty, chunks[1]);
    }

    // Footer / status
    let footer = if app.status.is_empty() {
        Paragraph::new("Move to start playing")
            .style(Style::default().fg(Color::DarkGray))
            .alignment(Alignment::Center)
    } else {
        Paragraph::new(app.status.as_str())
            .style(Style::default().fg(Color::Red))
            .alignment(Alignment::Center)
    }
    .block(Block::default().borders(Borders::ALL));
    f.render_widget(footer, chunks[2]);
}

fn render_board(board: &Board) -> Vec<Line<'static>> {
    let (rows, cols) = board.dim;
    let mut lines = Vec::new();

    for r in 0..rows {
        let mut spans = Vec::new();
        for c in 0..cols {
            let val = board.tile_at(r, c).unwrap_or(0);
            let (text, color) = tile_display(val);
            spans.push(Span::styled(
                format!(" {text:^5} "),
                Style::default().fg(color),
            ));
            if c < cols - 1 {
                spans.push(Span::raw("│"));
            }
        }
        lines.push(Line::from(spans));
        if r < rows - 1 {
            lines.push(Line::from(Span::raw(
                "───────┼───────┼───────".chars().take((cols as usize * 8 - 1).min(23)).collect::<String>(),
            )));
        }
    }
    lines
}

fn tile_display(val: u32) -> (&'static str, Color) {
    match val {
        0 => (" ", Color::DarkGray),
        2 => ("2", Color::Rgb(238, 228, 218)),
        4 => ("4", Color::Rgb(237, 224, 200)),
        8 => ("8", Color::Rgb(242, 177, 121)),
        16 => ("16", Color::Rgb(245, 149, 99)),
        32 => ("32", Color::Rgb(246, 124, 95)),
        64 => ("64", Color::Rgb(246, 94, 59)),
        128 => ("128", Color::Rgb(237, 207, 114)),
        256 => ("256", Color::Rgb(237, 204, 97)),
        512 => ("512", Color::Rgb(237, 200, 80)),
        1024 => ("1024", Color::Rgb(237, 197, 63)),
        2048 => ("2048", Color::Rgb(237, 194, 46)),
        _ => ("!!", Color::Magenta),
    }
}
