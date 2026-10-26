'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { DataFileError, DuplicateError, NotFoundError, ValidationError } = require('../errors');

/**
 * Base repository: stores an array of plain records in one JSON file using
 * the built-in fs/promises module. Subclasses only say which file and which
 * field is the ID, and add their own find methods.
 */
class JsonFileRepository {
  #filePath;
  #idField;

  constructor(filePath, idField) {
    if (!filePath) throw new ValidationError('A file path is required for a repository.');
    this.#filePath = path.resolve(filePath);
    this.#idField = idField;
  }

  get filePath() { return this.#filePath; }
  get idField() { return this.#idField; }
  get fileName() { return path.basename(this.#filePath); }

  /**
   * Reads every record. A missing file is created with an empty array,
   * and an empty file counts as an empty array.
   */
  async loadAll() {
    let text;
    try {
      text = await fs.readFile(this.#filePath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        await this.saveAll([]);
        return [];
      }
      throw new DataFileError(`Could not read ${this.fileName}: ${error.message}`, this.#filePath, error);
    }

    if (text.trim() === '') return [];

    let records;
    try {
      records = JSON.parse(text);
    } catch (error) {
      throw new DataFileError(`${this.fileName} does not contain valid JSON (${error.message}).`, this.#filePath, error);
    }
    if (!Array.isArray(records)) {
      throw new DataFileError(`${this.fileName} must contain a JSON array of records.`, this.#filePath);
    }
    return records;
  }

  /**
   * Replaces the file contents with the given records. Writes to a temporary
   * file first and then renames it, so a crash cannot leave a half-written file.
   */
  async saveAll(records) {
    if (!Array.isArray(records)) throw new ValidationError(`Records for ${this.fileName} must be an array.`);
    const json = JSON.stringify(records, null, 2);
    const tempPath = `${this.#filePath}.tmp`;
    try {
      await fs.mkdir(path.dirname(this.#filePath), { recursive: true });
      await fs.writeFile(tempPath, `${json}\n`, 'utf8');
      await fs.rename(tempPath, this.#filePath);
    } catch (error) {
      await fs.rm(tempPath, { force: true }).catch(() => {});
      throw new DataFileError(`Could not write ${this.fileName}: ${error.message}`, this.#filePath, error);
    }
    return records.length;
  }

  async create(record) {
    const id = record?.[this.#idField];
    if (!id) throw new ValidationError(`A record for ${this.fileName} needs a ${this.#idField}.`);
    const records = await this.loadAll();
    if (records.some((existing) => existing[this.#idField] === id)) {
      throw new DuplicateError(`${this.#idField} ${id} already exists in ${this.fileName}.`);
    }
    records.push(record);
    await this.saveAll(records);
    return record;
  }

  async findById(id) {
    const records = await this.loadAll();
    return records.find((record) => record[this.#idField] === id) ?? null;
  }

  async findWhere(predicate) {
    const records = await this.loadAll();
    return records.filter(predicate);
  }

  async update(id, changes) {
    const records = await this.loadAll();
    const index = records.findIndex((record) => record[this.#idField] === id);
    if (index === -1) throw new NotFoundError(`${this.#idField} ${id} was not found in ${this.fileName}.`);
    records[index] = { ...records[index], ...changes, [this.#idField]: id };
    await this.saveAll(records);
    return records[index];
  }
}

module.exports = JsonFileRepository;
