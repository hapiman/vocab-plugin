import UIKit

enum VocabularyListMode {
    case learning
    case mastered
}

final class VocabularyViewController: UITableViewController, UISearchResultsUpdating {
    private let store = VocabStore.shared
    private let mode: VocabularyListMode
    private let searchController = UISearchController(searchResultsController: nil)
    private var allEntries: [(String, VocabWord)] = []
    private var entries: [(String, VocabWord)] = []

    init(mode: VocabularyListMode = .learning) {
        self.mode = mode
        super.init(style: .plain)
    }

    required init?(coder: NSCoder) {
        self.mode = .learning
        super.init(coder: coder)
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = mode == .learning ? "词库" : "已掌握"
        setupNavigation()
        setupSearch()
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "WordCell")
        tableView.rowHeight = UITableView.automaticDimension
        tableView.estimatedRowHeight = 72
        refresh()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        refresh()
    }

    private func refresh() {
        allEntries = store.allWordsSorted
        applySearch()
    }

    private func setupNavigation() {
        guard mode == .learning else { return }
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            title: "已掌握",
            style: .plain,
            target: self,
            action: #selector(openMasteredWords)
        )
    }

    private func setupSearch() {
        searchController.searchResultsUpdater = self
        searchController.obscuresBackgroundDuringPresentation = false
        searchController.searchBar.placeholder = mode == .learning ? "搜索全部词库" : "搜索已掌握"
        navigationItem.searchController = searchController
        navigationItem.hidesSearchBarWhenScrolling = false
        definesPresentationContext = true
    }

    private func applySearch() {
        let query = searchController.searchBar.text?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
        let scopedEntries = scopedEntries(for: query)

        if query.isEmpty {
            entries = scopedEntries
        } else {
            entries = scopedEntries.filter { word, info in
                searchableText(word: word, info: info).contains(query)
            }
        }

        tableView.reloadData()
        updateEmptyState(query: query)
    }

    private func scopedEntries(for query: String) -> [(String, VocabWord)] {
        switch mode {
        case .learning:
            if query.isEmpty {
                return allEntries.filter { $0.1.status == "learning" }
            }
            return allEntries
        case .mastered:
            return allEntries.filter { $0.1.status == "mastered" }
        }
    }

    private func searchableText(word: String, info: VocabWord) -> String {
        let contextText = (info.contexts ?? []).compactMap(\.sentence).joined(separator: " ")
        return [
            word,
            info.definition ?? "",
            info.phonetic ?? "",
            contextText
        ].joined(separator: " ").lowercased()
    }

    private func updateEmptyState(query: String) {
        guard entries.isEmpty else {
            tableView.backgroundView = nil
            return
        }

        let emptyView = EmptyStateView()
        if !query.isEmpty {
            emptyView.configure(title: "没有找到单词", message: "换个关键词，或检查该词是否已经同步到 Gist。")
        } else if mode == .learning {
            emptyView.configure(title: "暂无学习中的词", message: "PC 浏览器扩展收词后，会出现在这里。")
        } else {
            emptyView.configure(title: "暂无已掌握单词", message: "在复习或词条详情中标记已掌握后，会出现在这里。")
        }
        tableView.backgroundView = emptyView
    }

    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        entries.count
    }

    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "WordCell", for: indexPath)
        let item = entries[indexPath.row]
        var content = cell.defaultContentConfiguration()
        content.text = item.0
        let statusText = item.1.status == "mastered" ? "已掌握" : "学习中"
        let definition = item.1.definition?.isEmpty == false ? item.1.definition! : "暂无释义"
        content.secondaryText = "\(statusText) · \(definition)"
        content.textProperties.font = .systemFont(ofSize: 18, weight: .semibold)
        content.secondaryTextProperties.numberOfLines = 2
        cell.contentConfiguration = content
        cell.accessoryType = item.1.status == "mastered" ? .checkmark : .none
        return cell
    }

    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        let item = entries[indexPath.row]
        navigationController?.pushViewController(WordDetailViewController(word: item.0), animated: true)
    }

    func updateSearchResults(for searchController: UISearchController) {
        applySearch()
    }

    @objc private func openMasteredWords() {
        navigationController?.pushViewController(VocabularyViewController(mode: .mastered), animated: true)
    }
}
