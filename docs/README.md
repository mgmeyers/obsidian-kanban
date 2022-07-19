# Obsidian Kanban Documentation
The documentation for this plugin (available at [http://matthewmeye.rs/obsidian-kanban/](http://matthewmeye.rs/obsidian-kanban/)) is generated using [MkDocs](https://www.mkdocs.org/getting-started/)

## Contributing
### Requirements
The following are required on your system to build docs locally:
- [Python 3.x](https://wiki.python.org/moin/BeginnersGuide/Download)
- [Pip](https://pip.pypa.io/en/stable/installation/)
- [Virtualenv](https://virtualenv.pypa.io/en/latest/installation.html)

### Setting Up
- `cd` into the `docs` directory
  ```
  cd docs/
  ```
- Create a new virtual environment. This allows isolation of the project's Python environment
  ```
  virtualenv venv
  ```
- Activate the virtual environment
  ```
  source venv/bin/activate
  ```
  Your terminal should change to the virtual environment
- Install the project requirements from the `requirements.txt` file:
  ```
  pip install -r requirements.txt
  ```
- Start the `mkdocs` dev server
  ```
  mkdocs serve
  ```
  The server should start, allowing you to view the documentation on your `localhost` on (the default) port `8000`: http://127.0.0.1:8000
  The project automatically rebuilds & reloads the site once changes are detected
