require("dotenv").config();
import { NotionAdapter } from "../adapters";
import { Clipping, GroupedClipping } from "../interfaces";
import { CreateClipEntryParams, CreatePageParams, Emoji, BlockType } from "../interfaces";
import {
  makeHighlightsBlocks,
  updateSync,
  getUnsyncedHighlights,
  getUnsyncedClippings,
  makeBlocks,
} from "../utils";
import { updateClipSync } from "../utils/common";

async function createNewClipDatabaseEntry(clip: Clipping, notionInstance: NotionAdapter) {
  const createClipEntryParams: CreateClipEntryParams = {
    parentDatabaseId: process.env.CLIP_DB_ID as string,
    properties: {
      hash_id: clip.hash_id,
      book: clip.title,
      author: clip.author,
      date: clip.date,
      highlight: clip.highlight,
      page: clip.page,
      location: clip.location,
    },
  }
  await notionInstance.createClipEntry(createClipEntryParams);
}
 
async function createNewbookHighlights(title: string, author: string, highlights: string[],  notionInstance: NotionAdapter) {
  const createPageParams: CreatePageParams = {
    parentDatabaseId: process.env.BOOK_DB_ID as string,
    properties: {
      title: title,
      author: author,
      bookName: title,
    },
    children: makeHighlightsBlocks(highlights, BlockType.quote),
    icon: Emoji["🔖"],
  }
  await notionInstance.createPage(createPageParams);
}

export class Notion {
  private notion;

  constructor() {
    this.notion = new NotionAdapter();
  }


  getIdFromClipHash = async (hash: string) => {
    const response = await this.notion.queryDatabase({
      database_id: process.env.CLIP_DB_ID as string,
      filter: {
        or: [
          {
            property: "hash_id",
            text: {
              equals: hash,
            },
          },
        ],
      },
    });
    const [clip] = response.results;
    if (clip) {
      return clip.id;
    } else {
      return null;
    }
  };

  /* Method to get Notion block id of the Notion page given the book name */
  getIdFromBookName = async (bookName: string) => {
    const response = await this.notion.queryDatabase({
      database_id: process.env.BOOK_DB_ID as string,
      filter: {
        or: [
          {
            property: "Book Name",
            text: {
              equals: bookName,
            },
          },
        ],
      },
    });
    const [book] = response.results;
    if (book) {
      return book.id;
    } else {
      return null;
    }
  };

  /* Method to sync highlights to notion */
  syncHighlights = async (books: GroupedClipping[]) => {
    try {
      // get unsynced highlights from each book
      const unsyncedBooks = getUnsyncedHighlights(books);
      // if unsynced books are present
      if (unsyncedBooks.length > 0) {
        console.log("\n🚀 Syncing highlights to Notion");
        for (const book of unsyncedBooks) {
          console.log(`\n🔁 Syncing book: ${book.title}`);
          const bookId = await this.getIdFromBookName(book.title);
          // if the book is already present in Notion
          if (bookId) {
            console.log(`📚 Book already present, appending highlights`);
            // append unsynced highlights at the end of the page
            
            if(book.highlights.length <= 100) {
              await this.notion.appendBlockChildren(
                bookId,
                makeBlocks(book.highlights, BlockType.quote)
              );
            } else {
              // handle pagination if there are more than 100 highlights
              let highlightsTracker = 0;
              while(highlightsTracker < book.highlights.length) {
                await this.notion.appendBlockChildren(
                  bookId,
                  makeBlocks(book.highlights.slice(highlightsTracker, highlightsTracker+99), BlockType.quote)
                );
                highlightsTracker+=99;
              }
            }
            
          } else {
            console.log(`📚 Book not present, creating notion page`);
            if(book.highlights.length <= 100) {
              await createNewbookHighlights(book.title, book.author, book.highlights, this.notion);
            } else {
              // handle pagination if there are more than 100 highlights
              let highlightsTracker = 0;
              while(highlightsTracker < book.highlights.length) {
                if(highlightsTracker == 0) {
                  // create a new page for the first 100 highlights
                  await createNewbookHighlights(book.title, book.author, book.highlights.slice(highlightsTracker, highlightsTracker+99), this.notion);
                  highlightsTracker += 99;
                } else {
                  // insert the remaining highlights by paginations
                  let newBookId = await this.getIdFromBookName(book.title);
                  if(newBookId) {
                    await this.notion.appendBlockChildren(
                      newBookId, 
                      makeBlocks(book.highlights.slice(highlightsTracker, highlightsTracker+99), BlockType.quote)
                    );
                    highlightsTracker += 99;
                  }
                }
              }
            }
          }
            
          // after each book is successfully synced, update the sync metadata (cache)
          updateSync(book);
        }
        console.log("\n✅ Successfully synced highlights to Notion");
      } else {
        console.log("🟢 Every book is already synced!");
      }
    } catch (error: unknown) {
      console.error("❌ Failed to sync highlights", error);
      throw error;
    } finally {
      console.log("--------------------------------------");
    }
  };

  /* Method to sync highlights to notion */
  syncHighlights_Clippings = async (clippings: Clipping[]) => {
    try {

      // get unsynced clippings
      const unsyncedClippings = getUnsyncedClippings(clippings);

      if (unsyncedClippings.length == 0) {
        console.log("🟢 Every book is already synced!");
        return;
      }

      console.log("\n🚀 Syncing clippings to Notion");
      for (const clip of unsyncedClippings) {
        console.log(`\n Syncing Clip: ${clip.hash_id}`);
        const hashId = await this.getIdFromClipHash(clip.hash_id);

        // if the clip is already present in notion
        if (hashId) {
          console.log(`Clip already present, doing nothing -- THIS IS AN ERROR CASE`);
          break;
        }

        console.log(`📚 Clip not present, creating notion page`);
        await createNewClipDatabaseEntry(clip, this.notion);

        // after each book is successfully synced, update the sync metadata (cache)
        updateClipSync(clip);
      }
      console.log("\n✅ Successfully synced clips to Notion");
    } catch (error: unknown) {
      console.error("❌ Failed to sync clippings", error);
      throw error;
    } finally {
      console.log("--------------------------------------");
    }
  };
}
