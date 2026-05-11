import UIKit

final class HomeViewController: UIViewController {
    private let store = VocabStore.shared
    private let statsView = StatSummaryView()
    private let syncLabel = UILabel()
    private let errorLabel = UILabel()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        setupViews()
        store.loadCachedWords()
        refresh()

        Task {
            await store.pullFromGist()
            refresh()
        }
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        refresh()
    }

    private func setupViews() {
        let startButton = UIButton(type: .system)
        startButton.setTitle("开始复习", for: .normal)
        startButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        startButton.backgroundColor = .systemBlue
        startButton.tintColor = .white
        startButton.layer.cornerRadius = 8
        startButton.heightAnchor.constraint(equalToConstant: 48).isActive = true
        startButton.addTarget(self, action: #selector(startReview), for: .touchUpInside)

        let syncButton = UIButton(type: .system)
        syncButton.setTitle("同步 Gist", for: .normal)
        syncButton.titleLabel?.font = .systemFont(ofSize: 16, weight: .semibold)
        syncButton.backgroundColor = .secondarySystemBackground
        syncButton.layer.cornerRadius = 8
        syncButton.heightAnchor.constraint(equalToConstant: 46).isActive = true
        syncButton.addTarget(self, action: #selector(syncGist), for: .touchUpInside)

        syncLabel.font = .systemFont(ofSize: 14)
        syncLabel.textColor = .secondaryLabel
        syncLabel.numberOfLines = 0

        errorLabel.font = .systemFont(ofSize: 14)
        errorLabel.textColor = .systemRed
        errorLabel.numberOfLines = 0

        let stack = UIStackView(arrangedSubviews: [
            statsView,
            startButton,
            syncButton,
            syncLabel,
            errorLabel
        ])
        stack.axis = .vertical
        stack.spacing = 18
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)

        NSLayoutConstraint.activate([
            statsView.heightAnchor.constraint(equalToConstant: 84),
            stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 24),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20)
        ])
    }

    private func refresh() {
        statsView.configure(
            due: store.dueCount,
            learning: store.learningCount,
            mastered: store.masteredCount
        )

        if let lastSyncAt = store.lastSyncAt {
            syncLabel.text = "最近同步：\(DateCoding.localMinuteString(lastSyncAt))"
        } else {
            syncLabel.text = "尚未同步。请在设置页填写 GitHub Token 和 Gist ID。"
        }
        errorLabel.text = store.lastError
    }

    @objc private func startReview() {
        navigationController?.pushViewController(ReviewViewController(), animated: true)
    }

    @objc private func syncGist() {
        Task {
            await store.pushIfNeeded()
            await store.pullFromGist()
            refresh()
        }
    }
}
