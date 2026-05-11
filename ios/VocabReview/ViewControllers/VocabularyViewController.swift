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
    /// Stable index assigned at load time; key = word, value = 1-based number
    private var stableIndices: [String: Int] = [:]
    private var needsFullRefresh = true

    init(mode: VocabularyListMode = .learning) {
        self.mode = mode
        super.init(style: .insetGrouped)
    }

    required init?(coder: NSCoder) {
        self.mode = .learning
        super.init(coder: coder)
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = mode == .learning ? "词库" : "已掌握"
        view.backgroundColor = Theme.Colors.pageBackground
        setupNavigation()
        setupSearch()
        setupPullToRefresh()
        tableView.register(VocabWordCell.self, forCellReuseIdentifier: "WordCell")
        tableView.rowHeight = UITableView.automaticDimension
        tableView.estimatedRowHeight = 76
        tableView.separatorInset = UIEdgeInsets(top: 0, left: 16, bottom: 0, right: 0)
        refresh()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        if needsFullRefresh {
            refresh()
        } else {
            // Soft update: re-read word data but keep order and indices stable
            softUpdate()
        }
    }

    // MARK: - Refresh Logic

    /// Full refresh: reload data, reassign indices
    private func refresh() {
        allEntries = store.allWordsSorted
        let scoped = scopedEntries(for: "")
        // Assign stable 1-based indices
        stableIndices.removeAll()
        for (i, entry) in scoped.enumerated() {
            stableIndices[entry.0] = i + 1
        }
        needsFullRefresh = false
        applySearch()
    }

    /// Soft update: refresh word data in-place, keep same order and indices
    private func softUpdate() {
        allEntries = store.allWordsSorted
        // Update entries content but preserve current order
        for i in entries.indices {
            let word = entries[i].0
            if let updated = store.words[word] {
                entries[i] = (word, updated)
            }
        }
        tableView.reloadData()
    }

    @objc private func handlePullToRefresh() {
        needsFullRefresh = true
        refresh()
        tableView.refreshControl?.endRefreshing()
    }

    private func setupPullToRefresh() {
        let rc = UIRefreshControl()
        rc.addTarget(self, action: #selector(handlePullToRefresh), for: .valueChanged)
        tableView.refreshControl = rc
    }

    private func setupNavigation() {
        guard mode == .learning else { return }
        let item = UIBarButtonItem(
            title: "已掌握",
            style: .plain,
            target: self,
            action: #selector(openMasteredWords)
        )
        item.image = UIImage(systemName: "checkmark.seal")
        navigationItem.rightBarButtonItem = item
    }

    private func setupSearch() {
        searchController.searchResultsUpdater = self
        searchController.obscuresBackgroundDuringPresentation = false
        searchController.searchBar.placeholder = mode == .learning ? "搜索全部词库" : "搜索已掌握"
        searchController.automaticallyShowsCancelButton = true
        searchController.searchBar.setValue("取消", forKey: "cancelButtonText")
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

    // MARK: - Table View

    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        entries.count
    }

    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "WordCell", for: indexPath) as! VocabWordCell
        let item = entries[indexPath.row]
        let index = stableIndices[item.0] ?? (indexPath.row + 1)
        cell.configure(index: index, word: item.0, info: item.1)
        return cell
    }

    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        let item = entries[indexPath.row]
        navigationController?.pushViewController(WordDetailViewController(word: item.0), animated: true)
    }

    override func tableView(_ tableView: UITableView, trailingSwipeActionsConfigurationForRowAt indexPath: IndexPath) -> UISwipeActionsConfiguration? {
        guard mode == .mastered else { return nil }
        let word = entries[indexPath.row].0
        let delete = UIContextualAction(style: .destructive, title: "删除") { [weak self] _, _, completion in
            guard let self else { completion(false); return }
            let alert = UIAlertController(title: "删除单词", message: "确定要删除「\(word)」吗？此操作不可撤销。", preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "取消", style: .cancel) { _ in completion(false) })
            alert.addAction(UIAlertAction(title: "删除", style: .destructive) { _ in
                self.store.deleteWord(word)
                self.entries.remove(at: indexPath.row)
                tableView.deleteRows(at: [indexPath], with: .automatic)
                self.updateEmptyState(query: "")
                completion(true)
            })
            self.present(alert, animated: true)
        }
        delete.image = UIImage(systemName: "trash.fill")
        return UISwipeActionsConfiguration(actions: [delete])
    }

    func updateSearchResults(for searchController: UISearchController) {
        applySearch()
    }

    @objc private func openMasteredWords() {
        navigationController?.pushViewController(VocabularyViewController(mode: .mastered), animated: true)
    }
}

// MARK: - Custom Word Cell

private final class VocabWordCell: UITableViewCell {
    private let indexLabel = UILabel()
    private let wordLabel = UILabel()
    private let definitionLabel = UILabel()
    private let statusBadge = UILabel()

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        setupCell()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupCell()
    }

    func configure(index: Int, word: String, info: VocabWord) {
        indexLabel.text = "\(index)"
        wordLabel.text = word

        let definition = info.definition?.isEmpty == false ? info.definition! : "暂无释义"
        definitionLabel.text = definition

        let isMastered = info.status == "mastered"
        statusBadge.text = isMastered ? "已掌握" : "学习中"
        statusBadge.textColor = isMastered ? Theme.Colors.statMastered : Theme.Colors.statLearning
        statusBadge.backgroundColor = (isMastered ? Theme.Colors.statMastered : Theme.Colors.statLearning).withAlphaComponent(0.1)
    }

    private func setupCell() {
        backgroundColor = Theme.Colors.cardBackground

        indexLabel.font = UIFont.rounded(ofSize: 15, weight: .bold)
        indexLabel.textColor = Theme.Colors.subtleText
        indexLabel.textAlignment = .center

        wordLabel.font = Theme.Font.headline
        wordLabel.textColor = .label

        definitionLabel.font = Theme.Font.body
        definitionLabel.textColor = .secondaryLabel
        definitionLabel.numberOfLines = 2

        statusBadge.font = UIFont.systemFont(ofSize: 11, weight: .semibold)
        statusBadge.textAlignment = .center
        statusBadge.layer.cornerRadius = 4
        statusBadge.clipsToBounds = true

        let textStack = UIStackView(arrangedSubviews: [wordLabel, definitionLabel])
        textStack.axis = .vertical
        textStack.spacing = Theme.Spacing.xs

        let mainRow = UIStackView(arrangedSubviews: [indexLabel, textStack, statusBadge])
        mainRow.axis = .horizontal
        mainRow.alignment = .center
        mainRow.spacing = Theme.Spacing.md

        indexLabel.translatesAutoresizingMaskIntoConstraints = false
        statusBadge.translatesAutoresizingMaskIntoConstraints = false
        statusBadge.setContentHuggingPriority(.required, for: .horizontal)
        statusBadge.setContentCompressionResistancePriority(.required, for: .horizontal)

        mainRow.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(mainRow)

        NSLayoutConstraint.activate([
            indexLabel.widthAnchor.constraint(equalToConstant: 28),
            statusBadge.widthAnchor.constraint(greaterThanOrEqualToConstant: 48),
            statusBadge.heightAnchor.constraint(equalToConstant: 22),
            mainRow.topAnchor.constraint(equalTo: contentView.topAnchor, constant: Theme.Spacing.md),
            mainRow.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: Theme.Spacing.md),
            mainRow.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -Theme.Spacing.lg),
            mainRow.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -Theme.Spacing.md)
        ])
    }
}
