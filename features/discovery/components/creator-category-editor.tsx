"use client";
import { CANONICAL_CREATOR_CATEGORIES } from "@/lib/creator-intelligence/taxonomy";
export function CreatorCategoryEditor({ categories = [], categoriesBusy = false, onCategoriesChange, plain = false }: {
 categories?: string[]; categoriesBusy?: boolean; onCategoriesChange?: (categories: string[]) => void; plain?: boolean;
}) {
 return (<section className={plain ? "tw-category-editor tw-category-editor--plain" : "tw-category-editor"} aria-label="Creator categories">
              <strong>Categories</strong>
              <div className="tw-category-editor__chips">
                {categories.map(category => <span className="tw-category-editor__chip" key={category}>
                  {category}
                  {onCategoriesChange ? <button type="button" aria-label={`Remove category ${category}`} disabled={categoriesBusy} onClick={() => onCategoriesChange(categories.filter(value => value !== category))}>&times;</button> : null}
                </span>)}
                {!categories.length ? <span>No categories set</span> : null}
              </div>
              {onCategoriesChange ? <select aria-label="Add creator category" value="" disabled={categoriesBusy} onChange={event => { if (event.target.value) onCategoriesChange([...categories, event.target.value]); }}>
                <option value="">+ Add category</option>
                {CANONICAL_CREATOR_CATEGORIES.filter(value => !categories.includes(value)).map(value => <option key={value} value={value}>{value}</option>)}
              </select> : null}
              <small role="status">{categoriesBusy ? "Saving categories..." : "Kept until refresh returns new category data."}</small>
            </section>);
}
