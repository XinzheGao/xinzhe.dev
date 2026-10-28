import { twMerge } from 'tailwind-merge'
import { cx } from 'classix'

/**
 * Combines and merges multiple CSS class names or values using the classix and tailwind-merge libraries.
 * This function takes any number of arguments and passes them to the cx function from classix,
 * which generates a combined class name string. The result is then passed to twMerge from tailwind-merge,
 * which merges any overlapping or duplicate classes into a final single string.
 * @param args The CSS class names or values to be combined and merged.
 * @returns A merged string containing the combined CSS class names or values.
 */
export function cn(...args) {
  return twMerge(cx(...args))
}

/**
 * Checks whether a given link is an external link by evaluating its href attribute.
 * If the href is empty or null, it is considered an internal link.
 * Otherwise, if the href does not start with '/' or '#', it is regarded as an external link.
 * @param href The href attribute value of the link to be checked.
 * @returns A boolean value indicating whether the link is an external link.
 */
export const isExternalLink = (href) => {
  if (!href) return false
  return !href.startsWith('/') && !href.startsWith('#')
}

/**
 * Formats a given date string into a localized date representation using the 'zh-CN' locale and Shanghai time zone.
 * The resulting date format includes the full month name, two-digit day, and the numeric year.
 * e.g. '1992年6月23日'
 * @param date The date string to be formatted.
 * @returns A localized date string representation formatted in Chinese.
 */
export const getDateTimeFormat = (date, locale = 'zh-CN') => {
  const dateObj = new Date(date)
  return Intl.DateTimeFormat(locale, {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'long',
    day: '2-digit'
  }).format(dateObj)
}

/**
 * Sorts an array of blog post objects based on their date field (only for old blog posts) or publication dates in descending order.
 * The function compares the 'date' property of each post or 'firstPublishedAt' property from the 'sys' object.
 * The posts are sorted by creating Date objects from the publication dates and comparing them.
 * @param posts The array of blog post objects to be sorted.
 * @returns The sorted array of blog posts in descending order based on their publication dates.
 */
export const getSortedPosts = (posts) => {
  return posts.sort((a, b) => {
    const dateA = a.date || a.sys.firstPublishedAt
    const dateB = b.date || b.sys.firstPublishedAt
    return new Date(dateB) - new Date(dateA)
  })
}

/**
 * Creates an instance of the DateTimeFormat object with 'zh-CN' locale and Shanghai time zone,
 * specifying the format to include the month and year in a two-digit and numeric format, respectively.
 * This formatter can be used to format date objects into a string representation with only the month and year.
 */
export const dateWithMonthAndYearFormatter = Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: 'long',
  year: 'numeric'
})

/**
 * Creates an instance of the DateTimeFormat object with 'zh-CN' locale and Shanghai time zone,
 * specifying the format to include the day and month in a two-digit format.
 * This formatter can be used to format date objects into a string representation with the day and month included.
 */
export const dateWithDayAndMonthFormatter = Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  day: 'numeric',
  month: 'long'
})

/**
 * Initializes an instance of `Intl.NumberFormat` named `viewCountFormatter`
 * with the 'zh-CN' locale for formatting view counts.
 *
 * Example usage:
 * const count = 1000000;
 * const formattedCount = viewCountFormatter.format(count);
 * console.log(formattedCount); // Output: "1,000,000"
 */
export const viewCountFormatter = new Intl.NumberFormat('zh-CN')
